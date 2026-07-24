require("dotenv").config();

const fs = require("fs");
const { MongoClient } = require("mongodb");

const client = new MongoClient(process.env.MONGODB_URI);


async function importSeed() {

    try {

        await client.connect();

        console.log("Connected to MongoDB Atlas");


        const db = client.db("TaxiCoDB");


        const seedData = JSON.parse(
            fs.readFileSync("./seed.json", "utf8")
        );


        const collections = [
            "provinces",
            "districts",
            "stations",
            "drivers",
            "vehicles",
            "trips",
            "pings",
            "api_keys",
            "users"
        ];


        for (const collectionName of collections) {

            if (
    seedData[collectionName] &&
    seedData[collectionName].length > 0
) {

    await db
        .collection(collectionName)
        .deleteMany({});


    await db
        .collection(collectionName)
        .insertMany(seedData[collectionName]);


    console.log(
        `${collectionName}: ${seedData[collectionName].length} imported`
    );

} else {

    console.log(
        `${collectionName}: No data found, skipped`
    );

}

        }


        console.log("✅ Seed import completed");


    } catch(error) {

        console.error("❌ Import Error:", error.message);

    } finally {

        await client.close();

    }

}


importSeed();