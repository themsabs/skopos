
/* Imports */
var express = require('express');
var app = express();
var fs = require("fs");
let ejs = require('ejs');
const cors = require('cors');
const bodyParser = require('body-parser');
var request = require('request');
const fileUpload = require('express-fileupload');
fs = require('fs');
/* Imports */

/* DB Setup */
var mongo = require('mongodb').MongoClient;
var url = "mongodb://localhost:27017/";

/* Express Setup */
app.set('view engine', 'ejs');
app.use(cors());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(express.static(__dirname + '/css'));

/* START SETUP ONLY - FIRST RUN MONGO SETUP */
/* Run these two pieces when starting project for the first time
mongo.connect(url, function(err, db) {
  if (err) throw err;
  var dbo = db.db("skopos");
  dbo.createCollection("indexes", function(err, res) {
    if (err) throw err;
    console.log("Collection created!");
    db.close();
  });
});
mongo.connect(url, function(err, db) {
  if (err) throw err;
  var dbo = db.db("tickers");
  dbo.createCollection("indexes", function(err, res) {
    if (err) throw err;
    console.log("Collection created!");
    db.close();
  });
});
*/
/* END SETUP ONLY - FIRST RUN MONGO SETUP */

/* Random ID Generator for CSV imports */
function makeid(length) {
    var result           = [];
    var characters       = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    var charactersLength = characters.length;
    for ( var i = 0; i < length; i++ ) {
      result.push(characters.charAt(Math.floor(Math.random() * 
 charactersLength)));
   }
   return result.join('');
}

//
// Home View Render
// 
app.get('/', function (req, res) {
	mongo.connect(url, function(err, db) {
	  if (err) throw err;
	  var dbo = db.db("skopos");
	  dbo.collection("indexes").find({}).toArray(function(err, results) {
	    if (err) throw err;
	    db.close();
	    var d = new Date(); // Today!
		d.setDate(d.getDate() - 1); // Yesterday!
		var dateString = new Date(d.getTime() - (d.getTimezoneOffset() * 60000 ))
                    .toISOString()
                    .split("T")[0];
	    res.render('indexes.ejs', {results: results, maxDate: dateString});  
	  });
	});
})

/* Download ticker data to our local MongoDB */
function cacheTicker(t, dbo) {
	return new Promise(resolve => {
		dbo.collection("tickers").findOne({ ticker : t }, function(err, result) {
		    if (err) throw err;
		    if(result === null) {
				var requestOptions = {
				    'url': 'https://api.tiingo.com/tiingo/daily/'+t+'/prices?startDate=1900-01-01&columns=close&token=ceaa5ce3beee0c58bff7820822975a68fc3fb302',
				    'headers': {
				        'Content-Type': 'application/json'
				        }
				};

				request(requestOptions,
				    function(error, response, body) {
				    	const insert = {ticker:t, data:JSON.stringify(body)};
				    	if (err) err;
						dbo.collection("tickers").insertOne(insert, function(err, res) {
						    if (err) throw err;
						    resolve(insert);
						});
				    }
				);      

			} else {
				resolve(result);
			}
		});
	});
}

//
// GET Index By ID
// Main logic where the index is calculated as value over time, as well as tickers are valued over time.
app.get('/indexes/:id', async function (req, res) {
	var tickerPerformance = [];
	var stringVal;
	//get the index tickers and weights
	mongo.connect(url, async function(err, db) {
	  if (err) throw err;
		var dbo = db.db("skopos");
		dbo.collection("indexes").findOne({ name: req.params.id }, async function(err, result) {
		    if (err) throw err;

		    //Calculate the individual performances of the tickers
		    tickersArr = result.tickers.split(",");
		    weightsArr = result.weights.split(",");
		    for (i = 0; i < tickersArr.length; i++) {
		    	var t = tickersArr[i];
		    	var cache = await cacheTicker(t, dbo);
		    	var startingCapital = parseFloat((parseFloat(weightsArr[i])/parseFloat(100)))*parseFloat(result.value);
		    	var json = JSON.parse(JSON.parse(cache.data));
		    	var shares = 0;
		    	var valuePerDay = [];
		    	for (j = 0; j < json.length; j++) {
		    		if(new Date(json[j].date) <= new Date(result.start)) continue;
		     		else {
		     			shares = (startingCapital / parseFloat(json[j].close));
		     			break;
		     		}
		    	}
		    	for (j = j; j < json.length; j++) {
		    		var arr = [];
		    		arr.push(Math.floor(new Date(json[j].date)));
		    		arr.push((shares*json[j].close));
		    		valuePerDay.push(arr);
		    	}
		    	tickerValue = {name: t, data: valuePerDay};
		    	tickerPerformance.push(tickerValue);
			}

			//Calculate the overall performance of the ticker index
			var sumValues = {};
			for (i = 0; i < tickerPerformance.length; i++) {
				for (j = 0; j < tickerPerformance[i].data.length; j++) {
					var date = tickerPerformance[i].data[j][0];
					var value = tickerPerformance[i].data[j][1];
					if(date in sumValues) sumValues[date] += parseFloat(value);
					else sumValues[date] = parseFloat(value);
				}
			}
			//Convert to timeseries
			var timeseries = [];
			for (key in sumValues) {
				timeseries.push([parseInt(key), sumValues[key]]);
			}
			tickerPerformance.push({name:"index", data: timeseries});
			stringVal = JSON.stringify(tickerPerformance);
			res.render('index.ejs', {data: stringVal} ); 
		});
	});
})

//
// Delete Index By ID
// 
app.delete('/indexes/:id', function (req, res) {
	mongo.connect(url, function(err, db) {
	  if (err) throw err;
	  var dbo = db.db("skopos");
	  var myquery = { name: req.params.id };
	  dbo.collection("indexes").deleteOne(myquery, function(err, obj) {
	    if (err) throw err;
	    db.close();
	  });
	});
  res.status(200).send('success');
})

//
// Edit/Update Index By ID
// 
app.post('/indexes/:id', function (req, res) {
   const body = req.body;
   mongo.connect(url, function(err, db) {
	  if (err) throw err;
	  var dbo = db.db("skopos");
	  dbo.collection("indexes").findOne({ name: req.params.id }, function(err, result) {
	    if (err) throw err;
	    if(result === null) {
	    	dbo.collection("indexes").insertOne(body, function(err, res) {
			    if (err) throw err;
			});
	    } else {
			var myquery = {  name: req.params.id };
			var newvalues = { $set: {name: body.name, tickers: body.tickers, weights: body.weights, value: body.value, start: body.start } };
		    dbo.collection("indexes").updateOne(myquery, newvalues, function(err, res) {
		      if (err) throw err;
		    });
	    }
	    db.close();
	  });
	});
   res.status(200).send('success');
})

//
// Endpoint for pulling csv files from directory and populating them into the DB
//
app.get('/loadCsv', function (req, res) {
	const fs = require('fs')
	var parse = require('csv-parse')


	// Loop through all the files in the temp directory
	fs.readdir("data/baskets/", function (err, files) {
	  if (err) {
	    console.error("Could not list the directory.", err);
	    process.exit(1);
	  }

	  files.forEach(function (file, index) {
	  	var parse = require('csv-parse');
		var parser = parse({columns: false}, function (err, records) {
			var tickers = "";
			var weights = "";
			for (i = 1; i < records.length; i++) {
				tickers += records[i][0] + ",";
				weights += (parseFloat(records[i][1])*parseFloat(100)) + ",";
			}
			tickers = tickers.substring(0, tickers.length - 1);
			weights = weights.substring(0, weights.length - 1);
			mongo.connect(url, function(err, db) {
			    if (err) throw err;
			    var dbo = db.db("skopos");
		    	dbo.collection("indexes").insertOne({name: makeid(5), tickers: tickers, weights: weights, value: 100, start: "2021-03-31"}, function(err, res) {
				    if (err) throw err;
				});
			    db.close();
			});
		});

		fs.createReadStream(__dirname+"/data/baskets/"+file).pipe(parser);

	  });
	});

	res.status(200).send('success');
})


var server = app.listen(8080, function () {
   var host = server.address().address
   var port = server.address().port
   console.log("Skopos app listening at http://%s:%s", host, port)
})