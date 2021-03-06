const fs = require('fs');
const path = require('path');

const webshot = require('webshot');
const request = require('request');
const styleNames = require('./utility/styleNames.js');
const prettier = require('prettier');
const untildify = require('untildify');
const gm = require('gm').subClass({
    imageMagick: true
});

const VERSION = '9.10.0';

const opts = {
    resolution: 1,
    theme: 'hybrid',
    font: 'Source Code Pro',
    fontSize: 20,
    background: '#fff',
    output: null,
    prettify: true, // use prettify to format `js`
    style: null, // override code styles injected by theme
    webshotCustomConfig: {
        // Using webshots default options
        shotSize: {
            width: 'window',
            height: 'window'
        },
        windowSize: {
            width: 1024,
            height: 768
        },
        shotOffset: {
            top: 0,
            right: 0,
            bottom: 0,
            left: 0
        }
    }
};

/**
 * Function to check whether file is JS or JSX.
 * This is used to define the parser to prettify code.
 * Currently only JS is supported. More formats are in development.
 * @param fileName: Name of the file.
 * @returns string: '.js' or '.jsx'
 */
function checkFileExtension(fileName) {
    if (fileName.endsWith('.js')) {
        return '.js';
    }
    return '';
}

/**
 * Prettify code based on the extension of the file.
 */
const prettify = (source, ext) => {
    switch (ext) {
        case '.js': {
            return prettier.format(source, {
                printWidth: 80,
                tabWidth: 4,
                singleQuote: true,
                trailingComma: 'none',
                bracketSpacing: true,
                parser: 'babylon'
            });
        }

        default: {
            return source;
        }
    }
};

function checkIfThemeExists(themeName) {
    if (styleNames.indexOf(themeName) !== -1) return true;
    return false;
}

function setBackground(cssURL, options) {
    request(cssURL, function(error, response, html) {
        if (!error && response.statusCode == 200) {
            let location,
                firstOccurence,
                backgroundOccurence,
                semiColonOccurence,
                colonOccurence;
            let sliced;

            location = html.toString().indexOf('.hljs{');
            sliced = html.slice(location);
            firstOccurence = sliced.indexOf('}') + 1;
            sliced = sliced.slice(0, firstOccurence);
            backgroundOccurence = sliced.indexOf('background');
            sliced = sliced.slice(backgroundOccurence);
            colonOccurence = sliced.indexOf(':') + 1;
            semiColonOccurence = sliced.indexOf(';');
            sliced = sliced.slice(colonOccurence, semiColonOccurence);
            options['background'] = sliced;
        }
    });
}

function generateHTML(sourceCode, options) {
    let themeName = options.theme.toLowerCase();

    let theme = checkIfThemeExists(themeName)
        ? `${themeName}.min.css`
        : 'hybrid.min.css';

    let cssURL = `https://cdnjs.cloudflare.com/ajax/libs/highlight.js/${VERSION}/styles/${theme}`;

    setBackground(cssURL, options);

    let scriptURL = `https://cdnjs.cloudflare.com/ajax/libs/highlight.js/${VERSION}/highlight.min.js`;

    let style = options.style ||
        `code{font-family: '${options.font}'; font-size:${options.fontSize}px; padding:20px}`;

    return `<html>
    <head> 
        <style>
            ${style}
        </style> 
        <link href="https://fonts.googleapis.com/css?family=Source+Code+Pro" rel="stylesheet">
        <link rel="stylesheet" href="${cssURL}" /> 
        <script src="${scriptURL}"></script>
        <script>hljs.initHighlightingOnLoad();</script>
    </head>
    <body>
    <pre>
    <code>${sourceCode}</code>
    </pre>
    </body}    
    </html>
    `;
}

/**Main function.
 * Set default arguments,
 * if options are not passed
 */

function codeSnipper(fileName, options = opts) {
    options = Object.assign(
        opts,
        { ext: checkFileExtension(fileName) },
        options);

    // Initialize webshot's configuration, setting resolution(zoomFactor) if passed.
    let webshotConfig = Object.assign({
        siteType: 'html',
        zoomFactor: options.resolution || 2.5},
        options.webshotCustomConfig || {});

    const imagePath = path.join(process.cwd(), fileName);

    const imageName = options.output
        ? untildify(options.output)
        : imagePath + '.png';

    //Read File and prettify code. Synchronous version is used for simplicity
    let sourceCode = '';
    fs.readFile(imagePath, (err, data) => {
        if (err) {
            throw new Error(err);
        }

        sourceCode = options.prettify
            ? prettify(data.toString(), options.ext)
            : data.toString();

        //Generate HTML
        const htmlString = generateHTML(sourceCode, options);

        webshot(htmlString, imageName, webshotConfig, err => {
            if (!err) {
                console.log('Image successfully saved as %s', imageName);
                gm(imageName)
                    .trim()
                    .trim()
                    .borderColor(options.background)
                    .border(20, 20)
                    .write(imageName, err => {
                        if (err) {
                            throw new Error(err);
                        }
                    });
            } else {
                throw new Error(err);
            }
            return;
        });
    });
    return 0;
}

module.exports = codeSnipper;