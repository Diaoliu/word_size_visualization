"use strict";

function Nanochart() {
    this.database = {};
    this.charts = [];
};

Nanochart.prototype.addData = function(file, callback) {
    var self = this;
    Papa.parse(file, {
        download: true,
        error: function(err) {
            alert(err);
        },
        complete: function(results) {
            var data     = results.data;
            var database  = {};
            var firstLine = data.shift();
            /* convert data format */
            firstLine.shift();
            database.labels = firstLine;
            database.series = {};
            data.forEach(function(line) {
                var key = line.shift();
                var value = line.map(function(el) {
                    return parseFloat(el);
                });
                database.series[key] = value;
            });
            /* add to global data collections */
            self.database = database;
            /* call initial process */
            callback(self);
        }
    });
};

Nanochart.prototype.addSparkline = function(nodeId, series, charttype) {
    return this._addChart(nodeId, series, charttype, 'sparkline');
};

Nanochart.prototype.addFigure = function(nodeId, series, charttype) {
    return this._addChart(nodeId, series, charttype, 'figure');
};

Nanochart.prototype.addLink = function(nodeId, action) {
    if (action) {
        $(nodeId).hover(
            this._highlight(action.target, action.series, action.index), 
            this._reset());
        $(nodeId).click(
            this._update(action.target, action.series));
    }
    return this;
};

Nanochart.prototype._addChart = function(nodeId, series, charttype, type) {
    var self = this;
    var node = $(nodeId);
    if (self.database.series.hasOwnProperty(series)) {
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
            this.charts.push(new Chartist.Bar(node[0], data, options));
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
        options.showPoint = false;
        options.lineSmooth = false;
        options.chartPadding.top = 5;
        options.chartPadding.bottom = 5;
        options.fullWidth = true;
    }
    return options;
};

Nanochart.prototype._figureOptions = function(charttype) {
    var options;
    if (charttype === 'bar') {
        options = {
            high: 20,
            low: 0,
            seriesBarDistance: 0
        };
    } else if (charttype === 'line') {
        options = {
            lineSmooth: false,
            fullWidth: true,
            showArea: true,
            chartPadding: {
                right: 50
            }
        };
    }
    return options;
};

Nanochart.prototype._highlight = function(chartName, series, index) {

}

Nanochart.prototype._update = function(chartName, series) {

};

var nano = new Nanochart();
nano.addData('csv/data.csv', function(self) {
    self.addSparkline('#papers-pro-year', 'papers pro year', 'bar')
        .addFigure('#papers', 'papers pro year', 'bar');
});