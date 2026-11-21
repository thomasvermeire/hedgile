#!/usr/bin/env node

/**
 * Menu Structure Validator
 * Validates that the navigation menu in index.html matches the specification
 */

const fs = require('fs');
const path = require('path');

// Read the HTML file
const htmlPath = path.join(__dirname, 'public', 'index.html');
const html = fs.readFileSync(htmlPath, 'utf8');

// Parse the HTML to extract menu structure
const { JSDOM } = require('jsdom');
const dom = new JSDOM(html);
const document = dom.window.document;

console.log('Validating Hedgile Navigation Menu...\n');

// Expected menu structure
const expectedStructure = {
    'Market Data': ['Metals', 'Currencies'],
    'Process': {
        'Purchasing': ['Quotes', 'Contracts', 'Call-offs', 'Deliveries', 'Inbound Delivery', 'Lots', 'Invoices'],
        'Sales': ['Quotes', 'Contracts', 'Call-offs', 'Deliveries', 'Outbound Delivery', 'Lots', 'Invoices'],
        'Quality': ['Inspection lots', 'Analysis', 'Certificates of Analysis'],
        'Hedging': ['Paper Transactions', 'Valuation Run', 'Reporting']
    },
    'Master Data': ['Companies', 'Materials', 'Customers', 'Vendors'],
    'Settings': []
};

// Expected locked items
const expectedLockedItems = [
    'Market Data:Currencies',
    'Purchasing:Quotes',
    'Purchasing:Invoices',
    'Sales:Quotes',
    'Sales:Outbound Delivery',
    'Sales:Invoices',
    'Hedging:Paper Transactions'
];

let allTestsPassed = true;

// Test 1: Check section order
console.log('Test 1: Checking section order...');
const sectionHeaders = Array.from(document.querySelectorAll('.section-header')).map(el => el.textContent.trim());
const expectedSections = Object.keys(expectedStructure);

let sectionsMatch = true;
expectedSections.forEach((expectedSection, index) => {
    if (sectionHeaders[index] !== expectedSection) {
        console.log(`  ❌ Section ${index + 1}: Expected "${expectedSection}", found "${sectionHeaders[index]}"`);
        sectionsMatch = false;
        allTestsPassed = false;
    }
});

if (sectionsMatch) {
    console.log('  ✅ All sections are in the correct order');
}

// Test 2: Check locked items
console.log('\nTest 2: Checking locked items...');
const lockedLinks = Array.from(document.querySelectorAll('.nav-link.locked')).map(link => {
    const text = link.textContent.trim();
    const section = link.closest('.nav-section')?.querySelector('.section-header')?.textContent.trim();
    const subsection = link.closest('.nav-subsection')?.querySelector('.subsection-header')?.textContent.trim();

    if (subsection) {
        // For items in subsections, use subsection:text format
        return `${subsection}:${text}`;
    } else if (section) {
        // For items directly in sections, use section:text format
        return `${section}:${text}`;
    }
    return text;
});

const expectedLocked = expectedLockedItems;

// Sort both arrays for comparison
const sortedLocked = lockedLinks.sort();
const sortedExpectedLocked = expectedLocked.sort();

let lockedMatch = true;
if (JSON.stringify(sortedLocked) !== JSON.stringify(sortedExpectedLocked)) {
    console.log('  ❌ Locked items mismatch');
    console.log('  Expected:', sortedExpectedLocked);
    console.log('  Found:', sortedLocked);
    lockedMatch = false;
    allTestsPassed = false;
} else {
    console.log('  ✅ All locked items are correct');
}

// Test 3: Check that all locked items have lock icons
console.log('\nTest 3: Checking lock icons on locked items...');
const lockedLinksWithIcons = document.querySelectorAll('.nav-link.locked');
let allHaveIcons = true;

lockedLinksWithIcons.forEach(link => {
    const lockIcon = link.querySelector('.fa-lock');
    if (!lockIcon) {
        console.log(`  ❌ Locked item "${link.textContent.trim()}" missing lock icon`);
        allHaveIcons = false;
        allTestsPassed = false;
    }
});

if (allHaveIcons) {
    console.log('  ✅ All locked items have lock icons');
}

// Test 4: Check menu structure
console.log('\nTest 4: Checking menu structure...');
let structureMatch = true;

for (const [section, content] of Object.entries(expectedStructure)) {
    const sectionElement = Array.from(document.querySelectorAll('.section-header')).find(
        el => el.textContent.trim() === section
    )?.parentElement;

    if (!sectionElement) {
        console.log(`  ❌ Section "${section}" not found`);
        structureMatch = false;
        allTestsPassed = false;
        continue;
    }

    if (Array.isArray(content)) {
        // This is a section with direct items
        const menuItems = Array.from(sectionElement.querySelectorAll('.nav-link')).map(
            el => el.textContent.trim()
        );

        if (JSON.stringify(menuItems) !== JSON.stringify(content)) {
            console.log(`  ❌ Menu items mismatch in section "${section}"`);
            console.log(`     Expected: ${JSON.stringify(content)}`);
            console.log(`     Found: ${JSON.stringify(menuItems)}`);
            structureMatch = false;
            allTestsPassed = false;
        }
    } else if (typeof content === 'object' && content !== null) {
        // This is a section with subsections
        for (const [subsection, items] of Object.entries(content)) {
            const subsectionElement = Array.from(sectionElement.querySelectorAll('.subsection-header')).find(
                el => el.textContent.trim() === subsection
            )?.parentElement;

            if (!subsectionElement) {
                console.log(`  ❌ Subsection "${subsection}" not found in section "${section}"`);
                structureMatch = false;
                allTestsPassed = false;
                continue;
            }

            const menuItems = Array.from(subsectionElement.querySelectorAll('.nav-link')).map(
                el => el.textContent.trim()
            );

            if (JSON.stringify(menuItems) !== JSON.stringify(items)) {
                console.log(`  ❌ Menu items mismatch in ${section}:${subsection}`);
                console.log(`     Expected: ${JSON.stringify(items)}`);
                console.log(`     Found: ${JSON.stringify(menuItems)}`);
                structureMatch = false;
                allTestsPassed = false;
            }
        }
    }
}

if (structureMatch) {
    console.log('  ✅ Menu structure is correct');
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
