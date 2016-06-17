Node-Red node to connect to Azure Table Storage
==============================

<a href="http://nodered.org" target="_new">Node-RED</a> nodes to talk to Azure Storage.

Some code of Azure are under MIT License.

Install
-------

Run the following command in your Node-RED user directory - typically `~/.node-red`

        npm install node-red-contrib-azure-table-storage

Usage
-----

Azure node. Can be used to save Entity, retrieve Entity and query on Azure Table Storage:

 - Supports :
 
◦Create/Delete Tables
◦Create/Read Entities

Still working on -> Query, Update and Delete Entities.

Use `msg.payload` to send a string with all data what you want to save to Azure Table Storage.

Ex: 'msg.payload' -> {"tableName": "name", "action": "I", "partitionKey": "part1", "rowKey": "row1", "data": "data"}
 


Read more about Azure Storage on <a href="https://azure.microsoft.com/pt-br/documentation/services/storage/">Azure Storage</a>.


