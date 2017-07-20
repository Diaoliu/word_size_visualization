"use strict";

function Nanochart() {
    this.database = {};
    this.charts = [];
};

Nanochart.prototype.addData = function(file, callback) {
    var self = this;
    $.ajax({
        url: file,
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
                    callback(self);
                }
            });
        }
    });
};

Nanochart.prototype.addSparkline = function(query, series, charttype) {
    var self = this,
        node = $('#' + query),
        data, options, chart;
    data = this._getData(series);
    if (data) {
        node.addClass('nc-sparkline');
        options = this._sparklineOptions(charttype);
        if (charttype === 'bar')
            chart = new Chartist.Bar(node[0], data, options);
        else if (charttype === 'line')
            chart = new Chartist.Line(node[0], data, options);
        chart.on('created', function(context) {
                self._addSparklineLabel(chart, charttype);
        });
        this.charts.push(chart);
    }
    return this;
};

Nanochart.prototype.addFigure = function(query, series, charttype) {
    var self = this,
        node = $('#' + query),
        data, options, chart;
    data = this._getData(series);
    if (data) {
        node.addClass('nc-figure');
        options = this._figureOptions(charttype);
        if (charttype === 'bar')
            chart = new Chartist.Bar(node[0], data, options);
        else if (charttype === 'line')
            chart = new Chartist.Line(node[0], data, options);
        chart.on('created', function(context) {
                self._addFigureLabel(chart, charttype);
        });
        this.charts.push(chart);
    }
    return this;
};

Nanochart.prototype.addLink = function(query, targets, series, filter) {
    var self = this,
        node = $('#' + query),
        data = self.database.series[series];
    if (data && node) {
        node.addClass('nc-text');
        if (filter) {
            data = data.map(function(element, index, array) {
                if (filter(element, index, array)) 
                    return element;
            });
        }
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

Nanochart.prototype._getData = function(series) {
    if (this.database.series 
        && this.database.series.hasOwnProperty(series)) {
        return {
            labels: this.database.labels,
            series: [this.database.series[series]]
        };
    } else {
        return undefined;
    }
};

Nanochart.prototype._sparklineOptions = function(charttype) {
    var options = {
        axisX: {
            showLabel: false,
            offset: 0
        },
        axisY: {
            showLabel: false,
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
                right: 0,
                bottom: 5,
                left: 0
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
        axisX: { labelOffset: {
              x: 0,
              y: 5
            } },
        showGridBackground: true,
        seriesBarDistance: 0
    };

    if (charttype === 'line') {
        Object.assign(options, {
            lineSmooth: false,
            axisX: { labelOffset: {
              x: -15,
              y: 5
            } },
            fullWidth: true,
            showArea: true
        });
    }
    return options;
};

Nanochart.prototype._addSparklineLabel = function(chart, charttype) {
    var self      = this,
        sparkline = $(chart.container),
        tooltip   = sparkline.find('.nc-sparkline-label'),
        line      = sparkline.find('.ct-grids .ct-horizontal').first(),
        label     = chart.data.labels[0] || 0,
        data      = chart.data.series[0][0] || 0,
        svg       = $(chart.svg.getNode());

    if (tooltip.length == 0)
        tooltip = $('<span class="nc-sparkline-label"></span>');

    tooltip.html(label + '<br>' + data);
    sparkline.append(tooltip);

    svg.mousemove(function(event) {
        var x = event.clientX - svg.offset().left,
            cellWidth = parseInt(svg.attr('width')) / chart.data.labels.length,
            index = Math.floor( x / cellWidth ),
            label = chart.data.labels[index] || 0,
            data  = chart.data.series[0][index] || 0;

        if (charttype === 'line')
            cellWidth = parseInt(svg.attr('width'))  / (self.database.labels.length - 1);

        line.attr('x1', x).attr('x2', x)
            .attr('y1', 0).attr('y2', svg.attr('height')).show();
        tooltip.html(label + '<br>' + data);
    });
}

Nanochart.prototype._addFigureLabel = function(chart, charttype) {
    var self    = this,
        figure  = $(chart.container),
        tooltip = figure.find('.nc-tooltip'),
        grid    = figure.find('.ct-grid-background'),
        left    = parseInt(grid.attr('x')),
        top     = parseInt(grid.attr('y')),
        right   = parseInt(grid.attr('width')) + left,
        bottom  = parseInt(grid.attr('height')) + top,
        svg     = $(chart.svg.getNode());

    if (tooltip.length == 0)
        tooltip = $('<div class="nc-tooltip"></div>').hide();

    figure.append(tooltip);

    svg.mousemove(function(event) {
        var x = event.clientX - svg.offset().left,
            y = event.clientY - svg.offset().top,
            cellWidth = ( right - left ) / (self.database.labels.length - 1);
            
        if (charttype === 'bar')
            cellWidth = ( right - left ) / self.database.labels.length;

        var index = Math.floor( ( x - left ) / cellWidth ),
            line  = figure.find('.ct-grids .ct-horizontal').first(),
            label = chart.data.labels[index],
            data  = chart.data.series[0][index] || 0;

        if (x >= left && x <= right
            && y > top && y < bottom) {
            tooltip.html(label + ': ' + data + ' ' + self.database.unit);
            tooltip.show();
            line.attr('x1', x).attr('x2', x).attr('y1', top).show();
        } else {
            line.hide();
            tooltip.hide();
        }
        
        tooltip.css('left', x - tooltip.outerWidth() / 2 + 'px');
    });
}

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
        firstLine = data.shift(),
        unit      = firstLine.shift();
    /* convert data format */
    database.unit   = unit;
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

/* new entity instance */
var nano = new Nanochart();
/* before adding sparkline or figure,
 * it needs to add data provider first */
nano.addData('/csv/data.csv', function(self) {
    /* parameters: mount node, series name, chart type */
    self.addSparkline('papers-pro-year', 'papers pro year', 'bar')
        .addFigure('papers', 'papers pro year', 'bar')
        /* parameters: mount node, target sparklines or figures,
         * series name, and user defined data filter function    */
        .addLink('first-approaches', ['papers-pro-year', 'papers'], 
            'papers pro year', function(element, index, array) {
                return index < 7;
        })
        .addLink('technique', ['papers'], 'technique papers');
});
