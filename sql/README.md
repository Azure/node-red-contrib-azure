Node-Red node to connect to Azure SQL Database
==============================

<a href="http://nodered.org" target="_new">Node-RED</a> nodes to talk to Azure SQL Database.

Some code of Azure is under MIT License.

Install
-------

Run the following command in your Node-RED user directory - typically `~/.node-red`

        npm install node-red-contrib-azure-sql

Usage
-----

Azure node. Can be used to work with Azure SQL Database

* Supports :
   * Select (query) into Azure SQL
   * Insert (query) into Azure SQL

# How to use:

You must create the database in Azure first to use Azure SQL node in Node-RED. You will use:
- Server address
- Database name
- Login
- Password

Use `msg.payload` to query data into Database.

------------

## Read Query
### Input Object:
Ex: `msg.payload` -> `{"action": "Q", "query" : "SELECT * FROM table WHERE firstName = 'John'"};`

### Response Object:
A JSON object will be returned for each row of output in this format:
```
{ 
  Name: "John",
  LastName: "Doe",
  Age: 29
}
```

--------

## Write Query
### Input Object:
Ex: `msg.payload` -> `{ "action": "I", "query": "insert into table (Name, LastName, Age) VALUES ('Jane', 'Doe', '25')" };`

### Response Object:
A String output will be returned for each insert query in this format:

```
"Insert Complete. ID of inserted item is 1017"
```
-----

Read more about Azure SQL Database on <a href="https://azure.microsoft.com/pt-br/documentation/services/sql-database/">Azure SQL Database</a>.


