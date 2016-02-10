var _ = require("underscore");
var rl = require("readline");

LPAREN = '('
RPAREN = ')'
IDENT = 'IDENT'
EOF = -1

function Lexer(source) {
	this.source = source
	this.line = 1
	this.column = 1
	this.token = ''
	this.pos = 0
}

function is_whitespace(c) {
	switch (c) {
		case ' ':
		case '\t':
		case '\n':
		case '\r':
			return true;
	}
	return false;
}

Lexer.prototype.char = function() {
	if (this.pos >= this.source.length) {
		return EOF;
	}
	return this.source.charAt(this.pos);
}

Lexer.prototype.next = function() {
	var char = this.char();
	if (char == '\r\n' || char == '\r' || char == '\n') {
		this.line++;
		this.column = 0;
	}
	this.pos++;
	this.column++;
	return this.char();
}

Lexer.prototype.scan_whitespace = function() {
	var char;
	while (is_whitespace(char = this.char())) {
		this.next();
	}
}

Lexer.prototype.scan_ident = function() {
	var char;
	this.token = '';
	while ((char = this.char()) !== EOF && char.match(/[a-z\-\.]/)) {
		this.token += char;
		this.next();
	}
	return this.token;
}

Lexer.prototype.scan = function() {
	var char;
	while ((char = this.char()) !== EOF) {
		if (char === LPAREN) {
			this.next();
			return ['LPAREN', LPAREN];
		}
		else if (char === RPAREN) {
			this.next();
			return ['RPAREN', RPAREN];
		}
		else if (char.match(/[a-z\-\.]/)) {
			return ['IDENT', this.scan_ident()];
		}
		else if (is_whitespace(char)) {
			this.scan_whitespace();
		}
		else {
			console.log("unexpected input on line", this.line);
			return EOF;
		}
	}
	return EOF;
}

function LispNode() {
	
}

LispNode.prototype = Array.prototype;

LispNode.prototype.form = function() {
	return this[0];
}

function Parser(lexer) {
	this.lexer = lexer;
}

Parser.prototype.parse = function() {
	var token;
	var form = new LispNode();
	var form_stack = [];
	while ((token = this.lexer.scan()) !== EOF) {
		//console.log('token', token);
		switch (token[0]) {
			case 'LPAREN':
				var newform = new LispNode();
				form.push(newform);
				form_stack.push(form);
				form = newform;
				break;
			case 'RPAREN':
				form = form_stack.pop();
				break;
			default:
				form.push(token[1]);
				break;
		}
	}
	return form;
}

function Compiler() {
	this.output = "";
}

Compiler.prototype.compile_define_form = function(node) {
	var output = "";
	output += "var " + node[1] + " = " + this.compile(node[2]) + ";";
	return output;
}

Compiler.prototype.compile_begin_form = function(node) {
	var compiler = this;
	var forms = _.map(node.slice(1), function(n) { return compiler.compile(n); });
	forms[forms.length-1] = "return " + forms[forms.length-1];
	return "(function() { " + forms.join("; ") + "})()";
}

Compiler.prototype.compile_if_form = function(node) {
	if (node.length < 3) {
		console.log("if form requires 3 elements");
		return;
	}
	var output = "";
	output += "(function() { ";
	output += "if (" + this.compile(node[1]) + ") { return " + this.compile(node[2]) + "; } ";
	if (node.length == 4) {
		output += "else { return " + this.compile(node[3]) + "} ";
	}
	output += "})()";
	return output;
}

Compiler.prototype.compile_fn_form = function(node) {
	var compiler = this;
	var output = "function(" + node[1].slice(0).join(", ") + ") { return " + compiler.compile(node[2]) + "; }";
	return output;
}

Compiler.prototype.compile_binary_op = function(node, op) {
	var compiler = this;
	var tests = _.map(node.slice(1), function(n) { return compiler.compile(n); });
	return "(" + tests.join(" " + op + " ") + ")";
}

Compiler.prototype.compile_js_layer = function(node, form) {
	return this.compile(node[2]) + "." + this.compile(node[1]);
}

Compiler.prototype.compile = function(root) {
	if (!root['form']) {
		return "(" + root + ")";
	}
	switch (root.form()) {
		case "define":
		case "begin":
		case "if":
		case "fn":
			return this["compile_"+root.form()+"_form"](root);
		case "equals":
		case "and":
		case "or":
		case "add":
		case "sub":
			var table = {equals: "===", and: "&&", or: "||", add: "+", sub: "-"};
			return this.compile_binary_op(root, table[root.form()]);
		case ".":
			return this.compile_js_layer(root, root.form());
		default:
			var compiler = this;
			var args = _.map(root.slice(1), function(n) { return compiler.compile(n); });
			return root.form() + "(" + args.join(", ") + ")";
	}
}

var rli = rl.createInterface(process.stdin, process.stdout, function() {
	
})
process.stdout.write('> ');
rli.on("line", function(source) {
	var lexer = new Lexer(source); // function(a, b) { return add(a, b); }
	var parser = new Parser(lexer);
	var ast = parser.parse();
	var compiler = new Compiler();
	for (var i = 0; i < ast.length; i++) {
		//console.log('-- COMPILED FORM', i, '--');
		console.log(compiler.compile(ast[i]));
	}
	process.stdout.write('> ');
});
