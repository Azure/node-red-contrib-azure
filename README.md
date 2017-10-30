Node-Red node to connect to Azure SQL Database
==============================

<a href="http://nodered.org" target="_new">Node-RED</a> nodes to talk to Azure SQL Database.

Some code of Azure are under MIT License.

Install
-------

Run the following command in your Node-RED user directory - typically `~/.node-red`

        npm install node-red-contrib-azure-sql

Usage
-----

Azure node. Can be used to work with Azure SQL Database

 - Supports :
 
◦Select (query) into Azure SQL
◦Insert (query) into Azure SQL

##How to use:

You must have create the database before to use. You will use:

- Azure SQL URL (endpoint)
- Login
- Password
- Database name

Use `msg.payload` to query data into Database.

Ex: 'msg.payload' -> {"action": "Q", "query" : "SELECT * FROM table WHERE firstName = 'Lucas'"};
Ex: 'msg.payload' -> { "action": "I", "query": "insert into table (Name, LastName, Age) VALUES ('Jane', 'Doe', '25')" };


Response Object:
Read Query -
Json object will be returned for each row of output in this format:
Ex:
object
{ Name: "Jane",
  LastName: "Doe",
  Age: 25
}

Write Query - 
String output
Ex:
"Insert Complete. ID of inserted item is 1017"

-----

Read more about Azure SQL Database on <a href="https://azure.microsoft.com/pt-br/documentation/services/sql-database/">Azure SQL Database</a>.


