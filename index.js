require("dotenv").config();
const express = require("express");
const app = express();
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

const port = process.env.PORT || 3000;

// Middlewares
app.use(cors());
app.use(express.json());

// MongoDB connection
const client = new MongoClient(process.env.MONGODB_URI, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    const database = client.db("cascadeblog");
    const blogCollection = database.collection("blogs");
    const wishlistCollection = database.collection("wishlists");

    // ============= API END POINTS

    // ==== Get all blogs with search & category filtering
    app.get("/blogs", async (req, res) => {
      const { search = "", category } = req.query;

      const query = {};
      if (search) {
        query.$text = { $search: search };
      }
      if (category && category !== "All") {
        query.category = category;
      }
      try {
        const blogs = await blogCollection
          .find(query)
          .sort({ createdAt: -1 })
          .toArray();
        res.send(blogs);
      } catch (err) {
        console.error(err);
        res.status(500).send({ err: "Failed to fetch blogs" });
      }
    });

    // ==== Get latest 6 blogs (optional usage)
    app.get("/latest-blogs", async (req, res) => {
      const blogs = await blogCollection
        .find()
        .sort({ createdAt: -1 })
        .limit(6)
        .toArray();
      res.send(blogs);
    });

    // ==== Get Single Blog
    app.get("/single-blog/:blogId", async (req, res) => {
      const id = req.params.blogId;
      const filter = { _id: new ObjectId(id) };
      const result = await blogCollection.findOne(filter);
      res.send(result);
    });

    // ==== Add new blog
    app.post("/add-blog", async (req, res) => {
      const newBlog = {
        ...req.body,
        createdAt: new Date(),
      };
      const result = await blogCollection.insertOne(newBlog);
      res.status(201).send(result);
    });

    // Test DB connection
    await client.db("admin").command({ ping: 1 });
    console.log("Connected to MongoDB!");
  } finally {
    // Don't close the client in production
    // await client.close();
  }
}
run().catch(console.dir);

// Base route
app.get("/", (req, res) => {
  res.send("CascadeBlog server is running...");
});

// Start server
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
