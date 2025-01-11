const { Client, LocalAuth } = require('whatsapp-web.js');  
const qrcode = require('qrcode-terminal');  
const { google } = require('googleapis');  
const sheets = google.sheets('v4');  
const fs = require('fs');  
  
const CREDENTIALS = JSON.parse(fs.readFileSync('credentials.json')); 
const SPREADSHEET_ID = '1IbNtklGrrPYN5jqqGV80d4MgHA3oGRsRUNX8bnayJac';
  
const client = new Client({  
    authStrategy: new LocalAuth()  
});
  
const auth = new google.auth.GoogleAuth({  
    credentials: CREDENTIALS,  
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],  
}); 

client.on('qr', (qr) => {  
    qrcode.generate(qr, { small: true });  
    console.log('QR code generated, scan it with your WhatsApp app.');  
});  
  
client.on('ready', () => {  
    console.log('Client is ready!');  
});  
  
async function appendToSheet(data, msg, type) {

    inputRange = ""

    if (type === "out") {
        inputRange = "Cashflow!B:F"
    } else {
        inputRange = "Cashflow!H:L"
    }
    const client = await auth.getClient();  
    const request = {  
        spreadsheetId: SPREADSHEET_ID,  
        range: inputRange,
        valueInputOption: 'RAW',  
        resource: {  
            values: [data],  
        },  
        auth: client,  
    };  
  
    try {  
        await sheets.spreadsheets.values.append(request);
        msg.reply(`Successfully write to sheet\n${data[1]} ${data[2]} ${data[3]} ${data[4]}`);
        console.log('Data appended to sheet:', data);
    } catch (error) {  
        msg.reply('Failed to write to sheet:', error)
        console.error('Error appending data to sheet:', error);  
    }  
}

async function addSomething(data, msg, type) {  
    const auth = new google.auth.GoogleAuth({  
        credentials: CREDENTIALS,  
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],  
    });

    column = ''
    if (type === 'Category') {
        const baseCategory = await getConfig("category");
        console.log(baseCategory.length)
        column = `Config!C${baseCategory.length+3}`
    } else if (type === 'Source') {
        const baseSource = await getConfig("source");
        column = `Config!B${baseSource.length+3}`
    } else {
        msg.reply('Invalid type, please use "Category" or "Source"');
    }
  
    const client = await auth.getClient();  
    const request = {  
        spreadsheetId: SPREADSHEET_ID,  
        range: column,
        valueInputOption: 'RAW',  
        resource: {  
            values: [data],  
        },  
        auth: client,  
    };  
  
    try {  
        await sheets.spreadsheets.values.append(request);
        console.log(request);
        
        msg.reply(`Successfully added ${type}: ${data[0]}`)
        console.log('Data appended to sheet:', data);
    } catch (error) {  
        msg.reply('Failed to write to sheet:', error)
        console.error('Error appending data to sheet:', error);  
    }  
}

function formatDateTime(date) {  
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
  
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
  
    return `${month}-${day}-${year} ${hours}:${minutes}:${seconds}`;
}

function capitalizeFirstLetter(string) {  
    if (!string) return string;
    return string.charAt(0).toUpperCase() + string.slice(1).toLowerCase();  
}  

client.on('message', async (msg) => {  
    const regexOutcome = /^([a-zA-Z\s]+)\s+(.+?)\s+([a-zA-Z\s]+)\s+([a-zA-Z\s]+)\s+(\d+)$/;
    const regexAction = /^([a-zA-Z\s]+)\s+([a-zA-Z\s]+)\s+([a-zA-Z\s]+)\s+([a-zA-Z\s]+)$/;
    const baseCategory = await getConfig("category");
    const baseSource = await getConfig("source");
    const lines = msg.body.split('\n');
  
    for (const line of lines) {  
        if (regexOutcome.test(line)) {
            const baseAction = ["in", "out"]
            const match = line.match(regexOutcome);    
            const type = match[1].trim();
            const item = match[2].trim();
            const category = match[3].trim();
            const source = match[4].trim();
            const price = parseInt(match[5], 10);  
            const formattedDateTime = formatDateTime(new Date());  
  
            const capitalizedItem = capitalizeFirstLetter(item);
            const capitalizedCategory = capitalizeFirstLetter(category);
            const capitalizedSource = capitalizeFirstLetter(source);
    
            if (!baseCategory.includes(capitalizedCategory)){  
                msg.reply(`Invalid category "${capitalizedCategory}". Please choose from: ${baseCategory}.`);  
            } else if (!baseSource.includes(capitalizedSource)) {
                msg.reply(`Invalid category "${capitalizedSource}". Please choose from: ${baseSource}.`);  
            } else if (!baseAction.includes(type)) {
                msg.reply(`Invalid action "${type}". Please choose from: ${baseAction}.`);
            } else {
                await appendToSheet([formattedDateTime, capitalizedItem, capitalizedCategory, capitalizedSource, price], msg, type);  
            }
        } else if (regexAction.test(line)) {
            const match = line.match(regexAction);    
            const type = match[2].trim();
            const action = match[3].trim();
            const category = match[4].trim();

            await addSomething([capitalizeFirstLetter(category)], msg, capitalizeFirstLetter(type));
        } else {  
            msg.reply(`Line "${line}" is not in the correct format. Please use: "item_name category price" (e.g., "mcdonalds food bca 20000").`);  
        }  
    }  
});
  
async function getConfig(type) {  
    const base = [];  
    baseRange = "";
    if (type === "category") {
        baseRange = "Config!C:C";
    } else if (type === "source"){
        baseRange = "Config!B:B";
    }

    const client = await auth.getClient(); 

    try {
        
        const response = await sheets.spreadsheets.values.get({  
          auth: client,  
          spreadsheetId: SPREADSHEET_ID,  
          range: baseRange,  
        });
      
        const values = response.data.values || [];  
      
        const categorySet = new Set(base);  
      
        values.forEach(row => {  
          const category = row[0];
          if (category && category !== capitalizeFirstLetter(type)) {
            categorySet.add(category); 
          }  
        });
      
        const combinedCategories = Array.from(categorySet);  
        console.log(combinedCategories); 
        return combinedCategories;
      
      } catch (error) {  
        console.error('Error reading from Google Sheets:', error);  
      } 
}  
  
client.initialize();

exports.handler = async (event, context) => {  
    // Your existing message handling logic here  
    // For example, you can access the message from event.body  
    const msg = JSON.parse(event.body);  
  
    // Process the message as you did in your original code  
    // Call your existing functions like appendToSheet, addSomething, etc.  
  
    return {  
        statusCode: 200,  
        body: JSON.stringify({ message: 'Function executed successfully!' }),  
    };  
};