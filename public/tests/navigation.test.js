/**
 * Navigation Menu Tests
 * Tests for the Hedgile navigation menu functionality
 */

// Mock DOM for testing
const { JSDOM } = require('jsdom');

function setupDOM() {
    const dom = new JSDOM(`
        <!DOCTYPE html>
        <html>
        <head>
            <link rel="stylesheet" href="styles.css">
        </head>
        <body>
            <nav class="sidebar">
                <ul class="nav-menu">
                    <li class="nav-section">
                        <span class="section-header">Market Data</span>
                        <ul class="nav-submenu">
                            <li>
                                <a href="#" class="nav-link">
                                    <i class="fas fa-cube"></i>
                                    <span>Metals</span>
                                </a>
                            </li>
                            <li>
                                <a href="#" class="nav-link locked" title="Locked">
                                    <i class="fas fa-lock"></i>
                                    <span>Currencies</span>
                                </a>
                            </li>
                        </ul>
                    </li>
                    <li class="nav-section">
                        <span class="section-header">Process</span>
                        <ul class="nav-submenu">
                            <li class="nav-subsection">
                                <span class="subsection-header">Purchasing</span>
                                <ul class="nav-submenu nested">
                                    <li>
                                        <a href="#" class="nav-link locked" title="Locked">
                                            <i class="fas fa-lock"></i>
                                            <span>Quotes</span>
                                        </a>
                                    </li>
                                    <li>
                                        <a href="#" class="nav-link">
                                            <i class="fas fa-file-contract"></i>
                                            <span>Contracts</span>
                                        </a>
                                    </li>
                                </ul>
                            </li>
                        </ul>
                    </li>
                </ul>
            </nav>
            <main class="main-content">
                <div class="content">
                    <h2>Welcome</h2>
                </div>
            </main>
            <script src="app.js"></script>
        </body>
        </html>
    `, { url: 'http://localhost' });
    
    global.document = dom.window.document;
    global.window = dom.window;
    global.HTMLElement = dom.window.HTMLElement;
    
    // Load the app.js code
    require('../app.js');
    
    return dom;
}

describe('Navigation Menu', () => {
    let dom;
    
    beforeEach(() => {
        dom = setupDOM();
    });
    
    afterEach(() => {
        delete global.document;
        delete global.window;
        delete global.HTMLElement;
    });
    
    test('Locked navigation items should have lock class', () => {
        const lockedLinks = document.querySelectorAll('.nav-link.locked');
        expect(lockedLinks.length).toBeGreaterThan(0);
        
        lockedLinks.forEach(link => {
            expect(link.classList.contains('locked')).toBe(true);
        });
    });
    
    test('Locked navigation items should have lock icon', () => {
        const lockedLinks = document.querySelectorAll('.nav-link.locked');
        
        lockedLinks.forEach(link => {
            const lockIcon = link.querySelector('.fa-lock');
            expect(lockIcon).not.toBeNull();
        });
    });
    
    test('Locked navigation items should have not-allowed cursor', () => {
        const lockedLinks = document.querySelectorAll('.nav-link.locked');
        
        lockedLinks.forEach(link => {
            const style = window.getComputedStyle(link);
            expect(style.cursor).toBe('not-allowed');
        });
    });
    
    test('Locked navigation items should not navigate when clicked', () => {
        const lockedLink = document.querySelector('.nav-link.locked');
        const clickEvent = new MouseEvent('click', { bubbles: true });
        
        // Mock preventDefault
        let prevented = false;
        clickEvent.preventDefault = () => { prevented = true; };
        
        lockedLink.dispatchEvent(clickEvent);
        expect(prevented).toBe(true);
    });
    
    test('Non-locked navigation items should be clickable', () => {
        const normalLink = document.querySelector('.nav-link:not(.locked)');
        const clickEvent = new MouseEvent('click', { bubbles: true });
        
        let prevented = false;
        clickEvent.preventDefault = () => { prevented = true; };
        
        normalLink.dispatchEvent(clickEvent);
        // The event should be prevented for SPA behavior, but the link should not be locked
        expect(normalLink.classList.contains('locked')).toBe(false);
    });
    
    test('Navigation menu should have correct structure', () => {
        // Check for Market Data section
        const marketDataSection = document.querySelector('.section-header:contains("Market Data")');
        expect(marketDataSection).not.toBeNull();
        
        // Check for Process section
        const processSection = document.querySelector('.section-header:contains("Process")');
        expect(processSection).not.toBeNull();
        
        // Check for Master Data section
        const masterDataSection = document.querySelector('.section-header:contains("Master Data")');
        expect(masterDataSection).not.toBeNull();
        
        // Check for Settings section
        const settingsSection = document.querySelector('.section-header:contains("Settings")');
        expect(settingsSection).not.toBeNull();
    });
    
    test('Process section should have correct subsections', () => {
        const processSection = document.querySelector('.section-header:contains("Process")')?.parentElement;
        expect(processSection).not.toBeNull();
        
        const subsections = processSection?.querySelectorAll('.subsection-header');
        expect(subsections).toHaveLength(4); // Purchasing, Sales, Quality, Hedging
    });
});

describe('Navigation Menu Structure Validation', () => {
    test('Menu order should match specification', () => {
        const sections = Array.from(document.querySelectorAll('.section-header')).map(el => el.textContent.trim());
        
        const expectedOrder = [
            'Market Data',
            'Process',
            'Master Data',
            'Settings'
        ];
        
        // Check if sections are in the correct order
        expectedOrder.forEach((expected, index) => {
            expect(sections[index]).toContain(expected);
        });
    });
    
    test('Process subsections should be in correct order', () => {
        const processSection = document.querySelector('.section-header:contains("Process")')?.parentElement;
        const subsections = Array.from(processSection?.querySelectorAll('.subsection-header') || []).map(el => el.textContent.trim());
        
        const expectedSubsections = ['Purchasing', 'Sales', 'Quality', 'Hedging'];
        
        expectedSubsections.forEach((expected, index) => {
            expect(subsections[index]).toContain(expected);
        });
    });
    
    test('Purchasing menu items should be in correct order', () => {
        const purchasingSubsection = document.querySelector('.subsection-header:contains("Purchasing")')?.parentElement;
        const menuItems = Array.from(purchasingSubsection?.querySelectorAll('.nav-link') || []).map(el => el.textContent.trim());
        
        const expectedItems = ['Quotes', 'Contracts', 'Call-offs', 'Deliveries', 'Inbound Delivery', 'Lots', 'Invoices'];
        
        expectedItems.forEach((expected, index) => {
            expect(menuItems[index]).toContain(expected);
        });
    });
    
    test('Sales menu items should be in correct order', () => {
        const salesSubsection = document.querySelector('.subsection-header:contains("Sales")')?.parentElement;
        const menuItems = Array.from(salesSubsection?.querySelectorAll('.nav-link') || []).map(el => el.textContent.trim());
        
        const expectedItems = ['Quotes', 'Contracts', 'Call-offs', 'Deliveries', 'Outbound Delivery', 'Lots', 'Invoices'];
        
        expectedItems.forEach((expected, index) => {
            expect(menuItems[index]).toContain(expected);
        });
    });
    
    test('Quality menu items should be in correct order', () => {
        const qualitySubsection = document.querySelector('.subsection-header:contains("Quality")')?.parentElement;
        const menuItems = Array.from(qualitySubsection?.querySelectorAll('.nav-link') || []).map(el => el.textContent.trim());
        
        const expectedItems = ['Inspection lots', 'Analysis', 'Certificates of Analysis'];
        
        expectedItems.forEach((expected, index) => {
            expect(menuItems[index]).toContain(expected);
        });
    });
    
    test('Hedging menu items should be in correct order', () => {
        const hedgingSubsection = document.querySelector('.subsection-header:contains("Hedging")')?.parentElement;
        const menuItems = Array.from(hedgingSubsection?.querySelectorAll('.nav-link') || []).map(el => el.textContent.trim());
        
        const expectedItems = ['Paper Transactions', 'Valuation Run', 'Reporting'];
        
        expectedItems.forEach((expected, index) => {
            expect(menuItems[index]).toContain(expected);
        });
    });
    
    test('Master Data menu items should be in correct order', () => {
        const masterDataSection = document.querySelector('.section-header:contains("Master Data")')?.parentElement;
        const menuItems = Array.from(masterDataSection?.querySelectorAll('.nav-link') || []).map(el => el.textContent.trim());
        
        const expectedItems = ['Companies', 'Materials', 'Customers', 'Vendors'];
        
        expectedItems.forEach((expected, index) => {
            expect(menuItems[index]).toContain(expected);
        });
    });
});

describe('Locked Items Validation', () => {
    test('Currencies should be locked', () => {
        const currenciesLink = Array.from(document.querySelectorAll('.nav-link')).find(link => 
            link.textContent.includes('Currencies')
        );
        
        expect(currenciesLink).not.toBeUndefined();
        expect(currenciesLink?.classList.contains('locked')).toBe(true);
    });
    
    test('Purchasing Quotes should be locked', () => {
        const purchasingQuotesLink = Array.from(document.querySelectorAll('.nav-link')).find(link => 
            link.closest('.nav-subsection')?.querySelector('.subsection-header')?.textContent.includes('Purchasing') &&
            link.textContent.includes('Quotes')
        );
        
        expect(purchasingQuotesLink).not.toBeUndefined();
        expect(purchasingQuotesLink?.classList.contains('locked')).toBe(true);
    });
    
    test('Purchasing Invoices should be locked', () => {
        const purchasingInvoicesLink = Array.from(document.querySelectorAll('.nav-link')).find(link => 
            link.closest('.nav-subsection')?.querySelector('.subsection-header')?.textContent.includes('Purchasing') &&
            link.textContent.includes('Invoices')
        );
        
        expect(purchasingInvoicesLink).not.toBeUndefined();
        expect(purchasingInvoicesLink?.classList.contains('locked')).toBe(true);
    });
    
    test('Sales Quotes should be locked', () => {
        const salesQuotesLink = Array.from(document.querySelectorAll('.nav-link')).find(link => 
            link.closest('.nav-subsection')?.querySelector('.subsection-header')?.textContent.includes('Sales') &&
            link.textContent.includes('Quotes')
        );
        
        expect(salesQuotesLink).not.toBeUndefined();
        expect(salesQuotesLink?.classList.contains('locked')).toBe(true);
    });
    
    test('Sales Outbound Delivery should be locked', () => {
        const salesOutboundLink = Array.from(document.querySelectorAll('.nav-link')).find(link => 
            link.closest('.nav-subsection')?.querySelector('.subsection-header')?.textContent.includes('Sales') &&
            link.textContent.includes('Outbound Delivery')
        );
        
        expect(salesOutboundLink).not.toBeUndefined();
        expect(salesOutboundLink?.classList.contains('locked')).toBe(true);
    });
    
    test('Sales Invoices should be locked', () => {
        const salesInvoicesLink = Array.from(document.querySelectorAll('.nav-link')).find(link => 
            link.closest('.nav-subsection')?.querySelector('.subsection-header')?.textContent.includes('Sales') &&
            link.textContent.includes('Invoices')
        );
        
        expect(salesInvoicesLink).not.toBeUndefined();
        expect(salesInvoicesLink?.classList.contains('locked')).toBe(true);
    });
    
    test('Paper Transactions should be locked', () => {
        const paperTransactionsLink = Array.from(document.querySelectorAll('.nav-link')).find(link => 
            link.closest('.nav-subsection')?.querySelector('.subsection-header')?.textContent.includes('Hedging') &&
            link.textContent.includes('Paper Transactions')
        );
        
        expect(paperTransactionsLink).not.toBeUndefined();
        expect(paperTransactionsLink?.classList.contains('locked')).toBe(true);
    });
});
