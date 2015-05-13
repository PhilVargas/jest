/**
 * Copyright (c) 2014, Facebook, Inc. All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 */
'use strict';

var colors = require('./lib/colors');
var formatFailureMessage = require('./lib/utils').formatFailureMessage;
var VerboseTestResultsTree = require('./lib/utils').VerboseTestResultsTree;
var path = require('path');

var FAIL_COLOR = colors.RED_BG + colors.BOLD;
var PASS_COLOR = colors.GREEN_BG + colors.BOLD;
var TEST_NAME_COLOR = colors.BOLD;

function DefaultTestReporter(customProcess) {
  this._process = customProcess || process;
}

DefaultTestReporter.prototype.log = function(str) {
  this._process.stdout.write(str + '\n');
};

DefaultTestReporter.prototype.onRunStart =
function(config, aggregatedResults) {
  this._config = config;
  this._printWaitingOn(aggregatedResults);
};

DefaultTestReporter.prototype.onTestResult =
function(config, testResult, aggregatedResults) {
  this._clearWaitingOn();

  var pathStr =
    config.rootDir
    ? path.relative(config.rootDir, testResult.testFilePath)
    : testResult.testFilePath;

  if (testResult.testExecError) {
    this.log(this._getResultHeader(false, pathStr));
    this.log(testResult.testExecError);
    return false;
  }

  var allTestsPassed = testResult.numFailingTests === 0;

  var testRunTime =
    testResult.perfStats
    ? (testResult.perfStats.end - testResult.perfStats.start) / 1000
    : null;

  var testRunTimeString = '(' + testRunTime + 's)';
  if (testRunTime > 2.5) {
    testRunTimeString = this._formatMsg(testRunTimeString, FAIL_COLOR);
  }

  /*
  if (config.collectCoverage) {
    // TODO: Find a nice pretty way to print this out
  }
  */

  // prepend each node key with __? incase someone writes a test title of testTitles
  // function createTestNode(testResult, ancestorTitles, currentNode){
  //   currentNode = currentNode || { testTitles: [], childNodes: {} };
  //   if (ancestorTitles.length === 0) {
  //     currentNode.testTitles.push(testResult);
  //   } else {
  //     if(!currentNode.childNodes[ancestorTitles[0]]){
  //       currentNode.childNodes[ancestorTitles[0]] = { testTitles: [], childNodes: {} };
  //     }
  //     createTestNode(
  //       testResult,
  //       ancestorTitles.slice(1,ancestorTitles.length),
  //       currentNode.childNodes[ancestorTitles[0]]
  //     );
  //   }
  //
  //   return currentNode;
  // }
  //
  // function createTestTree(results){
  //   var tree;
  //   for (var i = 0; i < results.length; i++){
  //     tree = createTestNode(results[i], results[i].ancestorTitles, tree);
  //   }
  //
  //   return tree;
  // }
  //
  // function preOrder(node, indentation){
  //   var indentationIncrement;
  //   if (typeof node === 'undefined' || node === null){ return; }
  //
  //   indentationIncrement = '  ';
  //   indentation = indentation || '';
  //
  //   if (Object.prototype.toString.call(node.testTitles) === '[object Array]'){
  //     printTestTitles.call(this, node.testTitles, indentation);
  //     preOrder.call(this, node.childNodes, indentation);
  //   } else {
  //     for (var key in node){
  //       this.log(indentation + key);
  //       preOrder.call(this, node[key], indentation + indentationIncrement);
  //     }
  //   }
  // }
  //
  // function printTestTitles(testTitles, indentation){
  //   var outputColor;
  //
  //   for (var i = 0; i < testTitles.length; i++){
  //     outputColor = testTitles[i].failureMessages.length === 0
  //       ? colors.GREEN
  //       : colors.RED;
  //     this.log(this._formatMsg(indentation + testTitles[i].title, outputColor));
  //   }
  // }

  if (config.verbose) {
    // var tree = createTestTree(testResult['testResults']);
    // preOrder.call(this, tree.childNodes)
    var verboseTestResultsTree = new VerboseTestResultsTree(testResult['testResults'], this.log.bind(this), this._formatMsg.bind(this))
    verboseTestResultsTree.init()
  } else {
    this.log(this._getResultHeader(allTestsPassed, pathStr, [
      testRunTimeString
    ]));
  }

  testResult.logMessages.forEach(this._printConsoleMessage.bind(this));

  if (!allTestsPassed) {
    this.log(formatFailureMessage(testResult, /*color*/!config.noHighlight));
  }

  this._printWaitingOn(aggregatedResults);
};

DefaultTestReporter.prototype.onRunComplete =
function (config, aggregatedResults) {
  var numFailedTests = aggregatedResults.numFailedTests;
  var numPassedTests = aggregatedResults.numPassedTests;
  var numTotalTests = aggregatedResults.numTotalTests;
  var runTime = aggregatedResults.runTime;

  if (numTotalTests === 0) {
    return;
  }

  var results = '';
  if (numFailedTests) {
    results += this._formatMsg(
      numFailedTests + ' test' + (numFailedTests === 1 ? '' : 's') + ' failed',
      colors.RED + colors.BOLD
    );
    results += ', ';
  }
  results += this._formatMsg(
    numPassedTests + ' test' + (numPassedTests === 1 ? '' : 's') + ' passed',
    colors.GREEN + colors.BOLD
  );
  results += ' (' + numTotalTests + ' total)';

  this.log(results);
  this.log('Run time: ' + runTime + 's');
};

DefaultTestReporter.prototype._printConsoleMessage = function(msg) {
  switch (msg.type) {
    case 'dir':
    case 'log':
      this._process.stdout.write(msg.data);
      break;
    case 'warn':
      this._process.stderr.write(
        this._formatMsg(msg.data, colors.YELLOW)
      );
      break;
    case 'error':
      this._process.stderr.write(
        this._formatMsg(msg.data, colors.RED)
      );
      break;
    default:
      throw new Error('Unknown console message type!: ' + msg.type);
  }
};

DefaultTestReporter.prototype._clearWaitingOn = function() {
  // Don't write special chars in noHighlight mode
  // to get clean output for logs.
  var command = this._config.noHighlight
    ? '\n'
    : '\r\x1B[K';
  this._process.stdout.write(command);
};

DefaultTestReporter.prototype._formatMsg = function(msg, color) {
  if (this._config.noHighlight) {
    return msg;
  }
  return colors.colorize(msg, color);
};

DefaultTestReporter.prototype._getResultHeader =
function (passed, testName, columns) {
  var passFailTag = passed
    ? this._formatMsg(' PASS ', PASS_COLOR)
    : this._formatMsg(' FAIL ', FAIL_COLOR);

  return [
    passFailTag,
    this._formatMsg(testName, TEST_NAME_COLOR)
  ].concat(columns || []).join(' ');
};

DefaultTestReporter.prototype._printWaitingOn = function(aggregatedResults) {
  var completedTests =
    aggregatedResults.numPassedTests +
    aggregatedResults.numFailedTests;
  var remainingTests = aggregatedResults.numTotalTests - completedTests;
  if (remainingTests > 0) {
    var pluralTests = remainingTests === 1 ? 'test' : 'tests';
    this._process.stdout.write(
      this._formatMsg(
        'Waiting on ' + remainingTests + ' ' + pluralTests + '...',
        colors.GRAY + colors.BOLD
      )
    );
  }
};

module.exports = DefaultTestReporter;
