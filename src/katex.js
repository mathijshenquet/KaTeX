/* eslint no-console:0 */
/**
 * This is the main entry point for KaTeX. Here, we expose functions for
 * rendering expressions either to DOM nodes or to markup strings.
 *
 * We also expose the ParseError class to check if errors thrown from KaTeX are
 * errors in the expression, or errors in javascript handling.
 */

var ParseError = require("./ParseError");
var Parser = require("./parser/Parser");

var builder = require("./builder");
var utils = require("./utils");

/**
 * Parse and build an expression, and place that expression in the DOM node
 * given.
 */
var render = function(expression, baseNode, settings) {
    utils.clearNode(baseNode);

    var tree = parseTree(expression, settings);
    var node = builder.buildHybrid(tree, expression, settings).toNode();

    baseNode.appendChild(node);
};

// KaTeX's styles don't work properly in quirks mode. Print out an error, and
// disable rendering.
if (typeof document !== "undefined") {
    if (document.compatMode !== "CSS1Compat") {
        typeof console !== "undefined" && console.warn(
            "Warning: KaTeX doesn't work in quirks mode. Make sure your " +
                "website has a suitable doctype.");

        render = function() {
            throw new ParseError("KaTeX doesn't work in quirks mode.");
        };
    }
}

/**
 * Parses an expression using a Parser, then returns the parsed result.
 */
var parseTree = function(toParse, settings) {
    var parser = new Parser(toParse, settings);

    return parser.parse();
};

/**
 * Parse and build an expression, and return the markup for that.
 */
var renderToString = function(expression, settings) {
    var tree = parseTree(expression, settings);
    return builder.buildHybrid(tree, expression, settings).toMarkup();
};

module.exports = {
    render: render,
    renderToString: renderToString,
    /**
     * NOTE: This method is not currently recommended for public use.
     * The internal tree representation is unstable and is very likely
     * to change. Use at your own risk.
     */
    __parse: parseTree,
    ParseError: ParseError,
    
    parseTree: parseTree,
    buildTree: builder.buildHybrid,
    buildHTML: builder.buildHTML,
    buildMathML: builder.buildMathML
};
