'use strict';

const Database = use('Database');
const Drive = use('Drive');
const Invoice = use('App/Models/Invoice');
const Helpers = use('Helpers');

const _ = require('lodash');
const Fs = require('fs');
const Path = require('path');
const Util = require('util');
const Puppeteer = require('puppeteer');
const Handlebars = require('handlebars');
const ReadFile = Util.promisify(Fs.readFile);

class InvoiceController {
  async index() {
    const allInvoices = await Invoice.query()
      .with('invoiceItems')
      .with('invoiceStatus')
      .with('contact')
      .fetch();

    return allInvoices;
  }

  async show({ request, response }) {
    // TODO
  }

  async getLatestInvoiceId() {
    const lastInvoice = await Database.select('invoice_number')
      .from('invoices')
      .orderBy('invoice_number', 'desc')
      .first();

    if (typeof lastInvoice === 'undefined') {
      // TODO
      // Get default value from database
      return 10000;
    }

    return lastInvoice.invoice_number;
  }

  async store({ request }) {
    /*
     * Get all invoice items from the invoice
     */
    let invoiceItems = request.input('invoiceItems');

    /*
     * Loop through the invoice items to get the total amount of the invoice
     */
    let invoiceNet = 0;
    await _.forEach(invoiceItems, value => {
      invoiceNet += value.cost * value.quantity;
    });

    const lastInvoice = await Database.select('invoice_number')
      .from('invoices')
      .orderBy('invoice_number', 'desc')
      .first();

    let lastInvoiceNumber = null;

    if (lastInvoice) {
      lastInvoiceNumber = ++lastInvoice.invoice_number;
    } else {
      // TODO get default number from database
      lastInvoiceNumber = 10000;
    }

    /*
     * Save the new invoice
     */
    const invoice = await Invoice.create({
      invoice_number: lastInvoiceNumber,
      // TODO invoiceStatusId
      invoice_status_id: 2,
      invoice_net: invoiceNet,
      contact_id: request.input('contactId'),
      invoice_date: request.input('invoiceDate'),
      due_date: request.input('dueDate')
    });

    /*
     * Save the related invoice items
     */
    await invoice.invoiceItems().createMany(invoiceItems);

    return invoice;
  }

  async html(id) {
    try {
      const invoiceData = await Invoice.query()
        .where('id', id)
        .with('invoiceItems')
        .first();

      const invoicePath = Helpers.viewsPath('invoice.html');

      const templatePath = Path.resolve(invoicePath);
      const content = await ReadFile(templatePath, 'utf8');

      const template = Handlebars.compile(content);

      return template(invoiceData);
    } catch (error) {
      throw new Error('Cannot create invoice HTML template.');
    }
  }

  async pdf({ params }) {
    if (!params.id) {
      return;
    }

    const html = await this.html(params.id);

    const browser = await Puppeteer.launch();
    const page = await browser.newPage();
    await page.setContent(html);

    const invoice = await page.pdf();

    return invoice;
  }
}

module.exports = InvoiceController;
