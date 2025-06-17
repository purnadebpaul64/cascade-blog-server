require("dotenv").config();
const express = require("express");
const app = express();
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const port = process.env.PORT || 3000;
const admin = require("firebase-admin");
const serviceAccount = require("./firebase-service-key.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

// Middlewares
app.use(cors());
app.use(express.json());

const verifyFIrebaseToken = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).send({ error: "Unauthorized access" });
  }
  const token = authHeader.split(" ")[1];

  try {
    const decoded = await admin.auth().verifyIdToken(token);
    // console.log("token decoded ============ ", decoded);
    req.decoded = decoded;
    next();
  } catch (error) {
    console.error("Token verification failed:", error);
    return res.status(401).send({ error: "Invalid or expired token" });
  }
};

// MongoDB connection
const client = new MongoClient(process.env.MONGODB_URI, {
  serverApi: {
    version: ServerApiVersion.v1,
    // strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    const database = client.db("cascadeblog");
    const blogCollection = database.collection("blogs");
    const wishlistCollection = database.collection("wishlists");
    const commentCollection = database.collection("comments");
    // await blogCollection.createIndex(
    //   {
    //     title: "text",
    //     blogDetails: "text",
    //     tags: "text",
    //   },
    //   {
    //     name: "BlogTextIndex",
    //     default_language: "english",
    //   }
    // );

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

      const projection = search ? { score: { $meta: "textScore" } } : {};
      const sort = search
        ? { score: { $meta: "textScore" } }
        : { createdAt: -1 };

      try {
        const blogs = await blogCollection
          .find(query, { projection })
          .sort(sort)
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
    app.post("/add-blog", verifyFIrebaseToken, async (req, res) => {
      const newBlog = {
        ...req.body,
        createdAt: new Date(),
      };
      const result = await blogCollection.insertOne(newBlog);
      res.status(201).send(result);
    });

    // ==== Add Comment to a Blog
    app.post("/comments", async (req, res) => {
      const { blogId, userName, userPhoto, commentText, userEmail } = req.body;
      const comment = {
        blogId: new ObjectId(blogId),
        userName,
        userPhoto,
        commentText,
        userEmail,
        createdAt: new Date(),
      };

      const result = await commentCollection.insertOne(comment);
      res.status(201).send(result);
    });

    // ==== Get Comments by Blog ID
    app.get("/comments/:blogId", async (req, res) => {
      const blogId = req.params.blogId;
      const comments = await commentCollection
        .find({ blogId: new ObjectId(blogId) })
        .sort({ createdAt: -1 })
        .toArray();
      res.send(comments);
    });

    // ==== Update blog
    app.put("/update-blog/:id", verifyFIrebaseToken, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const options = { upsert: true };
      const updatedBlog = req.body;
      const updatedDoc = {
        $set: updatedBlog,
      };
      const result = await blogCollection.updateOne(
        filter,
        updatedDoc,
        options
      );
      res.send(result);
    });

    // ==== featured blog
    app.get("/featured-blogs", async (req, res) => {
      try {
        const blogs = await blogCollection.find().toArray();

        const topBlogs = blogs
          .map((blog) => ({
            ...blog,
            wordCount: blog.blogDetails?.split(/\s+/).length || 0,
          }))
          .sort((a, b) => b.wordCount - a.wordCount)
          .slice(0, 10);

        res.send(topBlogs);
      } catch (error) {
        console.error("Failed to fetch featured blogs:", error);
        res.status(500).send({ error: "Failed to fetch featured blogs" });
      }
    });

    // ==== TOGGLE Wishlist
    app.post("/wishlist", async (req, res) => {
      const { blogId, userEmail } = req.body;
      const existing = await wishlistCollection.findOne({ blogId, userEmail });
      if (existing) {
        await wishlistCollection.deleteOne({ blogId, userEmail });
        return res.send({ wished: false, message: "Removed from wishlist" });
      } else {
        await wishlistCollection.insertOne({
          blogId,
          userEmail,
        });
        return res.send({ wished: true, message: "Added to wishlist" });
      }
    });

    // ==== GET Wishlisted Blogs by User Email ====
    app.get("/wishlist/:userEmail", verifyFIrebaseToken, async (req, res) => {
      const userEmail = req.params.userEmail;
      // console.log(req.headers);
      if (req.decoded.email !== userEmail) {
        return res.status(403).send({ error: "Forbidden" });
      }

      const wishlistItems = await wishlistCollection
        .find({ userEmail })
        .toArray();
      const blogIds = wishlistItems.map((item) => new ObjectId(item.blogId));
      const blogs = await blogCollection
        .find({ _id: { $in: blogIds } })
        .toArray();
      res.send(blogs);
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
