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
    // app.get("/blogs", async (req, res) => {
    //   const { search = "", category } = req.query;

    //   const query = {};
    //   if (search) {
    //     query.$text = { $search: search };
    //   }
    //   if (category && category !== "All") {
    //     query.category = category;
    //   }
    //   try {
    //     const blogs = await blogCollection
    //       .find(query)
    //       .sort({ createdAt: -1 })
    //       .toArray();
    //     res.send(blogs);
    //   } catch (err) {
    //     console.error(err);
    //     res.status(500).send({ err: "Failed to fetch blogs" });
    //   }
    // });

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
    app.post("/add-blog", async (req, res) => {
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
    app.put("/update-blog/:id", async (req, res) => {
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
    app.get("/wishlist/:userEmail", async (req, res) => {
      const userEmail = req.params.userEmail;
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
