const express = require('express');
const bodyParser = require('body-parser');
const crypto = require('crypto');
const path = require('path');
const app = express();
const fs = require('fs');
const port = process.env.PORT || 3000;

// Handlebars setup
app.set('view engine', 'hbs');
app.set('views', path.join(__dirname, 'views'));

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use('/public', express.static(path.join(__dirname, 'public')));

const hbs = require('hbs'); // make sure this line exists

// Register 'json' helper to stringify data
hbs.registerHelper('json', function (context) {
  return JSON.stringify(context);
});


// In-memory storage
const sessions = {};
const COMPANY = { name: "AZDBlast Platform", logoUrl: "https://via.placeholder.com/200x60.png?text=Client+Company+Logo" };

// Simulated product catalogconst 
const catalog = JSON.parse(fs.readFileSync('./product_catalog.json', 'utf8'));


// Simulate posting a comment to Respond.io via API
const axios = require('axios');

 async function postToRespond(contactIdentifier, message) {
  try {
    await axios.post(
      `https://api.respond.io/v2/contact/${contactIdentifier}/comment`,
      { text: message }, // ← API expects "text", not "body"
      {
        headers: {
          'Authorization': `Bearer ${process.env.RESPOND_API_KEY}`,
          'Content-Type': 'application/json',
        }
      }
    );
    console.log(`[Respond.io] Sent message to contact ${contactIdentifier}`);
  } catch (err) {
    console.error('Respond.io API error:', err.response?.data || err.message);
  }
}



// Endpoint #1: Entry point from Respond.io shortcut
app.post('/receive-request', async (req, res) => {
  const { customer, agent, conversationId } = req.body;

  // Basic validation
  if (!customer || !customer.id || !agent || !conversationId) {
    return res.status(400).json({
      status: "error",
      message: "Missing required fields: customer.id, agent, or conversationId"
    });
  }

  try {
    const sessionId = crypto.randomBytes(16).toString('hex');
    sessions[sessionId] = { customer, agent, conversationId, timestamp: Date.now() };
    const quoteUrl = `${req.protocol}://${req.get('host')}/quote/${sessionId}`;

    await postToRespond(
      `id:${customer.id}`,
      `🔗 Please fill out the quote here: ${quoteUrl}`
    );

    res.json({ status: "OK", quoteLink: quoteUrl, message: "Request for quote form received" });
  } catch (error) {
    console.error("Error in /receive-request:", error.message || error);
    res.status(500).json({
      status: "error",
      message: "Something went wrong while creating the quote request"
    });
  }
});


// Endpoint #2: Render the quote form
app.get('/quote/:sessionId', (req, res) => {
  const session = sessions[req.params.sessionId];
  if (!session) return res.status(404).send("Invalid or expired link.");
  
  res.render('quote', {
    company: COMPANY,
    agent: session.agent,
    customer: session.customer,
    sessionId: req.params.sessionId,
    catalog
  });
});

// Endpoint #3: Handle form submission
app.post('/submit-quote', async (req, res) => {
  const { sessionId, quantities = {} } = req.body;
  const session = sessions[sessionId];
  if (!session) return res.status(400).send("Session expired or invalid.");

  // Validate and build quote lines
  const lines = [];
  catalog.forEach(category => {
    category.items.forEach(item => {
      const qty = parseInt(req.body[`qty_${item.id}`], 10);
      if (qty > 0 && qty <= item.stock) {
        lines.push({ id: item.id, name: item.name, qty, price: item.price });
      }
    });
  });
  if (lines.length === 0) return res.send("No products selected or invalid quantities.");

  // Simulate ERP call
  const mockQuoteId = `Q-${Math.floor(Math.random() * 900000 + 100000)}`;
  console.log("[ERP] Created quote", mockQuoteId, lines);

  // Notify Respond.io
await postToRespond(
  `id:${session.customer.id}`,
  `✅ Quote ${mockQuoteId} has been submitted to the ERP for processing.`
);

  res.render('submitted', { company: COMPANY, quoteId: mockQuoteId, lines, agent: session.agent, customer: session.customer });
});

app.listen(port, () => console.log(`🚀 listening on http://localhost:${port}`));
