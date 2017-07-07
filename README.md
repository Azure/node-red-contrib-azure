# NodeRed-Azure-DocumentDB

Add-on nodes for Node RED (http://nodered.org) to perform various admnistrative and data operations against Azure's CosmosDB (formerly DocumentDB).

Please note: some code of Azure is under an MIT License.

## Install

Run the following command in your Node-RED user directory - typically `~/.node-red`

        npm install node-red-contrib-azure-documentdb

## Usage

Can be used to work with Azure DocumentDB using 3 nodes:

- `Database` -> Manages databases
- `Collections` -> Manage collections
- `Documents` -> Data operations against documents: Cread, Read, Update, Delete and Query

Once installed, you'll find the nodes under the `cloud` section.

For each of the nodes, you'll set the `msg.payload` to a configuration JSON that will instruct the node what to do when executed.

### Database Node

`msg.payload` Example:

        { "dbname": "databaseName", "action": "C" };

`action` values:

- "C" -> Creates a database
        * When you create a new database, the node will send as output the name of Database.
- "L" -> Lists databases
- "D" -> Deletes a database


### Collections Node

`msg.payload` Example:

        { "dbname": "databaseName", "collName": "collectionName", "action": "C" };

- put "C" to crete a Collection
- put "L" to list Collection
- put "D" to delete a Collection

### Documents Node

`msg.payload` Example:

        { "dbname": "databaseName", "collName": "collectionName", "action": "C" }

- "C" -> create a document
        * Specify your document by adding a property called `doc` to the configuration JSON, e.g.
        
        { "name": 'Lucas', "favoriteFood": "Pizza" }

- "L" -> list documents
- "D" -> delete a document
- "U" -> update a document
- "Q" -> query a documents
        * Specify your query by adding a property called `query` to the configuration JSON, e.g.
        
                `SELECT VALUE r.address FROM root r WHERE r.firstname = 'Lucas'`        

Results are passed to the next flow in `msg.payload`. If you need to retrieve the orignal query or check the status of the previous operation, you can check the `msg.docdb` object:

- `msg.docdb.query` -> Original executed query
- `msg.docdb.result` -> `OK` if the operation succeeded; `Error` if the operation failed

## References

Read more about Azure CosmosDB at https://azure.microsoft.com/pt-br/documentation/services/documentdb/.


