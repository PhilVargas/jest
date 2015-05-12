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

  function test(title, arr, memo){
    if (typeof memo === 'undefined' || memo === null){ memo = {}; }
    if (typeof memo.its === 'undefined' || memo.its === null){ memo.its = []; }
    if (typeof memo.desc === 'undefined' || memo.desc === null){ memo.desc = {}; }
    if (arr.length === 0) {
      memo.its.push(title);
      return memo;
    } else {
      if(typeof memo.desc[arr[0]] === 'undefined' || memo.desc[arr[0]] === null){
        memo.desc[arr[0]] = { its: [], desc: {} };
      }
      test(title, arr.slice(1,arr.length), memo.desc[arr[0]]);
    }
    return memo;
  }

  function repeatChar(character, count){
    var memo;

    memo = '';
    for (var i = 0; i < count; i++){
      memo += character;
    }
    return memo;
  }

  function readTest(tree, count){
    var key, outputText, outputColor

    if (typeof count === 'undefined' || count === null){ count = 0; }
    for (key in tree){
      this.log(repeatChar("  ", count) + key);
      for (var i = 0; i < tree[key].its.length; i++){
        outputText = repeatChar("  ", count + 1) + tree[key].its[i].title;
        outputColor = ( tree[key].its[i].failureMessages.length === 0 ? colors.GREEN : colors.RED);
        this.log( this._formatMsg(outputText, outputColor) );
      }
      if (Object.keys(tree[key].desc).length > 0){
        readTest.call(this, tree[key].desc, count + 1);
      }
    }
  }

  var results = testResult['testResults'];
  var tmp;
  if (config.verbose) {
    for (var i = 0; i < results.length; i++){
      tmp = test(results[i], results[i].ancestorTitles, tmp);
    }
    readTest.call(this, tmp.desc);
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
