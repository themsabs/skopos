# Skopos Demo

#Install
MongoDB and Express aree required to run this program.
MongoDB Install: https://docs.mongodb.com/manual/installation/
NPM Install: https://docs.npmjs.com/cli/v7/commands/npm-install

Move into the program directory, and run `npm install`. This will automatically pull all of the neccessary packages.
Start mongodb in another tab, `~/mongodb/bin/mongod`
Start the program in the first tab, `node server.js`
Visit `http://localhost:8080/` for the program.

#Usage
Indexes can be added through the form on the right hand side, there is an example in the placeholder of each form input.
Indexes can also be pulled from the supplied baskets folder by prressing the "Import CSV Baskets" button.
Indexes appear in the table on the left.
Clicking view, will trigger them to be displayed in the Highcharts below.
Clicking edit, will input the data to the form on the right. If the name stays the same, the data is edited for that existing index. If the name changes, you are now creating a new index.
Clicking delete, will prompt you to confirm, and then will delete the index.

#Features
Stock ticker info is cached to the MongoDB local to reduce load across the system and on the API.
Stock ticker info is pulled for the full history of the stock on the first pull, such that the start date can be moved with ease in the gui.

#Improvements
Stocks are not verified by their ticker, so an improper ticker may result in an error.
Value calculations are not cached, this would allow for lower user latency and reduced computation. This would also allow for indexes containing a very large number of tickers.