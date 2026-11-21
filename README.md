# Hedgile - Nickel Trade Management System

Hedgile helps small trading teams manage nickel trades from contract to final invoice, giving them a clear view of their daily positions and valuations. It turns scattered trade data into a single place where users can see what they've bought or sold, track payments, and understand their profit or loss at any time.

## Features

### Navigation Menu

The application features a comprehensive sidebar navigation menu organized according to business processes:

**Menu Structure:**
- **Market Data**
  - Metals: one entry per active reference
  - Currencies (locked)

- **Process**
  - **Purchasing**
    - Quotes (locked)
    - Contracts
    - Call-offs
    - Deliveries
    - Inbound Delivery
    - Lots
    - Invoices (locked)
  - **Sales**
    - Quotes (locked)
    - Contracts
    - Call-offs
    - Deliveries
    - Outbound Delivery (locked)
    - Lots
    - Invoices (locked)
  - **Quality**
    - Inspection lots
    - Analysis
    - Certificates of Analysis
  - **Hedging**
    - Paper Transactions (locked)
    - Valuation Run
    - Reporting

- **Master Data**
  - Companies
  - Materials
  - Customers
  - Vendors

- **Settings**

**Locked Entries:**
Locked menu items display a lock icon (🔒) and do not navigate when clicked. They provide visual feedback (shake animation) when users attempt to access them. Currently locked items:
- Market Data: Currencies
- Purchasing: Quotes, Invoices
- Sales: Quotes, Outbound Delivery, Invoices
- Hedging: Paper Transactions

### Icons

All icons use the Font Awesome 6.4.0 icon set, matching the hedgile.com website style. Each menu item has an appropriate icon that visually represents its function:

- Market Data: fa-chart-area
- Metals: fa-cube
- Currencies: fa-lock (locked)
- Process: fa-cogs
- Purchasing: fa-shopping-cart
- Sales: fa-tag
- Quality: fa-microscope
- Hedging: fa-shield-alt
- Contracts: fa-file-contract
- Call-offs: fa-phone-alt
- Deliveries: fa-truck
- Inbound Delivery: fa-box-open
- Outbound Delivery: fa-lock (locked)
- Lots:fa-pallet
- Invoices:fa-lock (locked)
- Inspection lots:fa-clipboard-list
- Analysis:fa-flask
- Certificates of Analysis:fa-certificate
- Paper Transactions:fa-lock (locked)
- Valuation Run:fa-calculator
- Reporting:fa-chart-bar
- Master Data:fa-database
- Companies:fa-building
- Materials:fa-layer-group
- Customers:fa-users
- Vendors:fa-user-tie
- Settings:fa-cog

## Project Structure

```
hedgile/
├── src/
│   └── index.js              # Cloudflare Worker entry point
├── public/
│   ├── index.html            # Main HTML file
│   ├── styles.css            # CSS styles
│   ├── app.js                # JavaScript functionality
│   └── tests/
│       └── navigation.test.js # Navigation menu tests
├── package.json              # Project dependencies
├── wrangler.toml             # Cloudflare Workers configuration
└── README.md                 # This file
```

## Deployment

This is a Cloudflare Workers application. To deploy:

1. Install dependencies:
   ```bash
   npm install
   ```

2. Install wrangler CLI:
   ```bash
   npm install -g wrangler
   ```

3. Deploy to Cloudflare:
   ```bash
   npm run deploy
   ```

4. For development:
   ```bash
   npm run dev
   ```

## Testing

Run the navigation menu tests:

```bash
cd public
npm install
npm test
```

Or run with watch mode:

```bash
npm run test:watch
```

## Acceptance Criteria Met

1. ✅ Menu order matches the specification
2. ✅ Locked entries show a lock icon and do not navigate
3. ✅ Icons match the hedgile.com website set

## Browser Support

- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)

## License

MIT
