"use strict";

function Nanochart() {
    this.database = {};
    this.charts = [];
};

Nanochart.prototype.addData = function(file, callback) {
    var self = this;
    $.ajax({
        url: file,
        async: false,
        timeout: 3000,
        error: function() {
            alert('Can not load CSV file!');
        },
        success: function(data) {
            Papa.parse(data, {
                error: function(err) {
                    alert(err);
                },
                complete: function(results) {
                    self._parseData(results.data);
                }
            });
        }
    });
    return this;
};

Nanochart.prototype.addSparkline = function(query, series, charttype) {
    return this._addChart(query, series, charttype, 'sparkline');
};

Nanochart.prototype.addFigure = function(query, series, charttype) {
    return this._addChart(query, series, charttype, 'figure');
};

Nanochart.prototype.addLink = function(query, targets, series, filter) {
    var self = this,
        node = $('#' + query),
        data = self.database.series[series];
    if (data && node) {
        node.addClass('nc-text');
        if (filter)
            data = filter(self.database.series[series]);
        node.hover(function () {
            targets.forEach(function(target) {
                self.addSeries(target, data);
            });   
        }, function() {
            targets.forEach(function(target) {
                self.removeSeries(target);
            }); 
        });
        node.click(function() {
            targets.forEach(function(target) {
                self.replaceSeries(target, data);
            });
        });
    }
    return this;
};

Nanochart.prototype.addSeries = function(chartName, series) {
    this._update('add', chartName, series);
}

Nanochart.prototype.removeSeries = function(chartName) {
    this._update('remove', chartName);
};

Nanochart.prototype.replaceSeries = function(chartName, series) {
    this._update('replace', chartName, series); 
};

Nanochart.prototype._addChart = function(query, series, charttype, type) {
    var self = this;
    var node = $('#' + query);
    if (self.database.series 
        && self.database.series.hasOwnProperty(series)) {
        var data = {
            labels: self.database.labels,
            series: [self.database.series[series]]
        };
        var options;
        if (type === 'sparkline'){
            node.addClass('nc-sparkline');
            options = this._sparklineOptions(charttype);
        }
        else if (type === 'figure') {
            node.addClass('nc-figure');
            options = this._figureOptions(charttype);
        }

        if (charttype === 'bar')
            this.charts.push(Chartist.Bar(node[0], data, options));
        else if (charttype === 'line')
            this.charts.push(new Chartist.Line(node[0], data, options));
    }
    return this;
}

Nanochart.prototype._sparklineOptions = function(charttype) {
    var options = {
        axisX: {
            showLabel: false,
            showGrid: false,
            offset: 0
        },
        axisY: {
            showLabel: false,
            showGrid: false,
            offset: 0
        },
        high: this.database.max,
        low: this.database.min,
        width: this.database.labels.length * 6,
        /* 1.5 * line height */
        height: '1.5em',
        seriesBarDistance: 0,
        chartPadding: {
            top: 0,
            right: 0,
            bottom: 0,
            left: 0
        }
    };
    if (charttype === 'line') {
        Object.assign(options, {
            showPoint: false,
            lineSmooth: false,
            chartPadding: {
                top: 5,
                bottom: 5,
            },
            fullWidth: true
        });
    }
    return options;
};

Nanochart.prototype._figureOptions = function(charttype) {
    var options = {
        high: this.database.max,
        low: this.database.min,
        seriesBarDistance: 0
    };

    if (charttype === 'line') {
        Object.assign(options, {
            lineSmooth: false,
            fullWidth: true,
            showArea: true,
            chartPadding: {
                right: 50
            }
        });
    }
    return options;
};

Nanochart.prototype._update = function(action, chartName, series) {
    this.charts.forEach(function(chart) {
        if (chart.container.id === chartName) {
            var data = chart.data;
            if (action === 'add') {
                data.series.push(series);
            } else if (action === 'remove' && data.series.length > 1) {
                data.series.pop();
            } else if (action === 'replace') {
                data.series = [series];
            }
            chart.update(data);
        }
    }); 
};

Nanochart.prototype._parseData = function(data) {
    var database  = {}, 
        all       = [],
        firstLine = data.shift();
    /* convert data format */
    firstLine.shift();
    database.labels = firstLine;
    database.series = {};
    data.forEach(function(line) {
        var key = line.shift();
        var value = line.map(function(el) {
            var v = parseFloat(el);
            all.push(v);
            return v;
        });
        database.series[key] = value;
    });
    database.max = Math.max(...all);
    database.min = Math.min(...all);
    /* add to global data collections */
    this.database = database;
};

var nano = new Nanochart();
nano.addData('/csv/data.csv')
    .addSparkline('papers-pro-year', 'papers pro year', 'bar')
    .addFigure('papers', 'papers pro year', 'bar')
    .addLink('first-approaches', ['papers-pro-year', 'papers'], 'papers pro year', function(series) {
        return series.map(function(value, index) {
            return (index <= 7)? value : 0;
        });
    })
    .addLink('technique', ['papers'], 'technique papers');