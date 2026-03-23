require('dotenv').config();
const mongoose = require('mongoose');
const Article = require('./server/models/Article');

async function debug() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        const articles = await Article.find().lean();
        console.log('--- DEBUG: Articles in DB ---');
        articles.forEach(a => {
            console.log(`ID: ${a._id}`);
            console.log(`Title: ${a.title}`);
            console.log(`Slug: ${a.slug}`);
            console.log(`Content length: ${a.content ? a.content.length : 'MISSING'}`);
            console.log(`Owner: ${a.owner}`);
            console.log('---');
        });
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}
debug();
