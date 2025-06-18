const express = require('express');
const bodyParser = require('body-parser');
const crypto = require('crypto');
const path = require('path');
const app = express();
const port = process.env.PORT || 3000;

// Handlebars setup
app.set('view engine', 'hbs');
app.set('views', path.join(__dirname, 'views'));

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use('/public', express.static(path.join(__dirname, 'public')));

// In-memory storage
const sessions = {};
const COMPANY = { name: "AZDBlast Platform", logoUrl: "https://via.placeholder.com/200x60.png?text=Client+Company+Logo" };

// Simulated product catalog
const catalog = [
  {
    category: "Widgets",
    items: [
      { id: "w1", name: "Red Widget", desc: "High-quality red widget", price: 99.99, stock: 10 },
      { id: "w2", name: "Blue Widget", desc: "Durable blue widget", price: 109.49, stock: 5 }
    ]
  },
  {
    category: "Gadgets",
    items: [
      { id: "g1", name: "Gizmo Pro", desc: "Premium gadget tool", price: 249.00, stock: 3 },
      { id: "g2", name: "Gizmo Lite", desc: "Budget-friendly version", price: 149.50, stock: 8 }
    ]
  }
];

// Simulate posting a comment to Respond.io via API
async function postToRespond(conversationId, text) {
  console.log(`[Respond.io] Convo ${conversationId}: ${text}`);
}

// Endpoint #1: Entry point from Respond.io shortcut
app.post('/receive-request', async (req, res) => {
  const { customer, agent, conversationId } = req.body;
  const sessionId = crypto.randomBytes(16).toString('hex');
  sessions[sessionId] = { customer, agent, conversationId, timestamp: Date.now() };
  const quoteUrl = `${req.protocol}://${req.get('host')}/quote/${sessionId}`;
  
  await postToRespond(conversationId, `🔗 Please fill out the quote: ${quoteUrl}`);
  res.json({ status: "OK", quoteLink: quoteUrl });
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
  await postToRespond(session.conversationId, `✅ Quote created: ${mockQuoteId}`);
  res.render('submitted', { company: COMPANY, quoteId: mockQuoteId, lines, agent: session.agent, customer: session.customer });
});

app.listen(port, () => console.log(`🚀 listening on http://localhost:${port}`));
