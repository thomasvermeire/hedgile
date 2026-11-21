#!/usr/bin/env node

/**
 * Simple Menu Structure Validator
 * Validates that the navigation menu in index.html matches the specification
 * without requiring external dependencies
 */

const fs = require('fs');
const path = require('path');

// Read the HTML file
const htmlPath = path.join(__dirname, 'public', 'index.html');
const html = fs.readFileSync(htmlPath, 'utf8');

console.log('Validating Hedgile Navigation Menu...\n');

let allTestsPassed = true;

// Test 1: Check section order
console.log('Test 1: Checking section order...');
const expectedSections = [
    'Market Data',
    'Process',
    'Master Data',
    'Settings'
];

let sectionsFound = [];
const sectionRegex = /<span class="section-header">\s*<i[^>]*>\s*<\/i>\s*([^<]+)\s*<\/span>/g;
let match;
while ((match = sectionRegex.exec(html)) !== null) {
    sectionsFound.push(match[1].trim());
}

let sectionsMatch = true;
expectedSections.forEach((expectedSection, index) => {
    if (sectionsFound[index] !== expectedSection) {
        console.log(`  ❌ Section ${index + 1}: Expected "${expectedSection}", found "${sectionsFound[index] || 'NOT FOUND'}"`);
        sectionsMatch = false;
        allTestsPassed = false;
    }
});

if (sectionsMatch && sectionsFound.length === expectedSections.length) {
    console.log('  ✅ All sections are in the correct order');
} else if (sectionsFound.length !== expectedSections.length) {
    console.log(`  ❌ Expected ${expectedSections.length} sections, found ${sectionsFound.length}`);
    allTestsPassed = false;
}

// Test 2: Check locked items
console.log('\nTest 2: Checking locked items...');
const expectedLockedItems = [
    'Currencies',
    'Quotes',  // Purchasing Quotes
    'Invoices', // Purchasing Invoices
    'Quotes',  // Sales Quotes
    'Outbound Delivery',
    'Invoices', // Sales Invoices
    'Paper Transactions'
];

// Count locked links
const lockedLinkRegex = /<a[^>]*class="nav-link locked"[^>]*>/g;
const lockedLinks = html.match(lockedLinkRegex) || [];

console.log(`  Found ${lockedLinks.length} locked links`);

if (lockedLinks.length !== expectedLockedItems.length) {
    console.log(`  ❌ Expected ${expectedLockedItems.length} locked items, found ${lockedLinks.length}`);
    allTestsPassed = false;
} else {
    console.log('  ✅ Correct number of locked items');
}

// Test 3: Check that all locked items have lock icons
console.log('\nTest 3: Checking lock icons on locked items...');
const lockedWithLockIconRegex = /<a[^>]*class="nav-link locked"[^>]*>\s*<i class="fas fa-lock"[^>]*>\s*<\/i>/g;
const lockedWithLockIcon = html.match(lockedWithLockIconRegex) || [];

if (lockedWithLockIcon.length !== lockedLinks.length) {
    console.log(`  ❌ Expected all ${lockedLinks.length} locked items to have lock icons, found ${lockedWithLockIcon.length}`);
    allTestsPassed = false;
} else {
    console.log('  ✅ All locked items have lock icons');
}

// Test 4: Check that all menu items exist
console.log('\nTest 4: Checking all menu items exist...');
const allMenuItems = [
    'Metals',
    'Currencies',
    'Contracts',
    'Call-offs',
    'Deliveries',
    'Inbound Delivery',
    'Lots',
    'Invoices',
    'Quotes',
    'Outbound Delivery',
    'Inspection lots',
    'Analysis',
    'Certificates of Analysis',
    'Paper Transactions',
    'Valuation Run',
    'Reporting',
    'Companies',
    'Materials',
    'Customers',
    'Vendors'
];

let allItemsFound = true;
allMenuItems.forEach(item => {
    const itemRegex = new RegExp(`<span>${item}<\/span>`, 'i');
    if (!itemRegex.test(html)) {
        console.log(`  ❌ "${item}" not found in menu`);
        allItemsFound = false;
        allTestsPassed = false;
    }
});

if (allItemsFound) {
    console.log(`  ✅ All ${allMenuItems.length} menu items found`);
}

// Test 6: Check Process subsections
console.log('\nTest 6: Checking Process subsections...');
const expectedSubsections = ['Purchasing', 'Sales', 'Quality', 'Hedging'];

let subsectionsFound = [];
const subsectionRegex = /<span class="subsection-header">\s*<i[^>]*>\s*<\/i>\s*([^<]+)\s*<\/span>/g;
while ((match = subsectionRegex.exec(html)) !== null) {
    subsectionsFound.push(match[1].trim());
}

let subsectionsMatch = true;
expectedSubsections.forEach((expectedSubsection, index) => {
    if (subsectionsFound[index] !== expectedSubsection) {
        console.log(`  ❌ Subsection ${index + 1}: Expected "${expectedSubsection}", found "${subsectionsFound[index] || 'NOT FOUND'}"`);
        subsectionsMatch = false;
        allTestsPassed = false;
    }
});

if (subsectionsMatch && subsectionsFound.length === expectedSubsections.length) {
    console.log('  ✅ All Process subsections are in the correct order');
} else if (subsectionsFound.length !== expectedSubsections.length) {
    console.log(`  ❌ Expected ${expectedSubsections.length} subsections, found ${subsectionsFound.length}`);
    allTestsPassed = false;
}

// Final result
console.log('\n' + '='.repeat(50));
if (allTestsPassed) {
    console.log('✅ All validation tests passed!');
    process.exit(0);
} else {
    console.log('❌ Some validation tests failed');
    process.exit(1);
}
