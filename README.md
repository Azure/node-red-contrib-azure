Node-Red node to connect to Azure DocumentDB
==============================

<a href="http://nodered.org" target="_new">Node-RED</a> nodes to talk to Azure DocumentDB.

Some code of Azure are under MIT License.

Install
-------

Run the following command in your Node-RED user directory - typically `~/.node-red`

        npm install node-red-contrib-azure-documentdb

Usage
-----

Azure node. Can be used to work with Azure DocumentDB using 3 nodes:

 - Supports :
 
◦CRUD Database

Still finishing Collections and Documents Node


##Database Node
Use `msg.payload` to create, delete and list the Database name.

Ex: 'msg.payload' -> {"dbname": "databaseName", "action": "C"};

*put "C" to crete a Database
        - If you create a new database, the node will send as output the name of Database.
*put "L" to list Database
*put "D" to delete a Database


##Collections Node
Use `msg.payload` to create, delete and list the Collection name.

Ex: 'msg.payload' -> {"dbname": "databaseName", "collName": "colletionName", "action": "C"};

*put "C" to crete a Collection
*put "L" to list Collection
*put "D" to delete a Collection

##Documents Node
Use `msg.payload` to work with documents in DocumentDB

Ex: 'msg.payload' -> Still working


-----

Read more about Azure Storage on <a href="https://azure.microsoft.com/pt-br/documentation/services/storage/">Azure Storage</a>.


