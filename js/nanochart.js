"use strict";

function Nanochart(database) {
    this.database = database;
    this.charts = {};
};

Nanochart.prototype.addSparkline = function(el, chartid, table, series, charttype) {
    var self = this,
        data, options, chart;
    data = this._getData(table, series);
    if (data) {
        options = this._sparklineOptions(table, charttype);
        if (charttype === 'bar')
            chart = new Chartist.Bar(el, data, options);
        else if (charttype === 'line')
            chart = new Chartist.Line(el, data, options);
        chart.on('created', function(context) {
                self._addSparklineLabel(chart, charttype);
        });
        chart.table = table;
        this.charts[chartid] = chart;
    }
    return this;
};

Nanochart.prototype.addFigure = function(el, chartid, table, series, charttype) {
    var self = this,
        data, options, chart;
    data = this._getData(table, series);
    if (data) {
        options = this._figureOptions(table, charttype);
        if (charttype === 'bar')
            chart = new Chartist.Bar(el, data, options);
        else if (charttype === 'line')
            chart = new Chartist.Line(el, data, options);
        chart.on('created', function(context) {
                self._addFigureLabel(chart, charttype);
        });
        chart.table = table;
        this.charts[chartid] = chart;
    }
    return this;
};

Nanochart.prototype.addLink = function($el, targets, series, filter) {
    var self = this,
        table = targets[0].table;
        data = self.database[table].series[series];
    if ($el && data) {
        if (filter) {
            data = data.map(function(element, index, array) {
                if (filter(element, index, array)) 
                    return element;
            });
        }
        $el.hover(function () {
            targets.forEach(function(target) {
                self.addSeries(target, data);
            });   
        }, function() {
            targets.forEach(function(target) {
                self.removeSeries(target);
            }); 
        });
        $el.click(function() {
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

Nanochart.prototype.dataFilter = function(filter) {
    var fn, args, token = [];
    /* remove all white spaces */
    filter = filter.replace(/\s+/g, "");
    /* valid filter syntax */
    if(/^[A-Za-z_]\w*\(\d*(,\d+)*\)/.test(filter)) {
        token = filter.split(/\(|\)/);
        token = token.filter(function(el) {
            return el != "";
        });
        fn = token.shift();
        if (token.length != 0) {
            args = token[0].split(",");
        }
    }
    switch(fn) {
        case "index":
            return function(element, index, array) {
              return args.includes(index);
            };
        case "slice":
            return function(element, index, array) {
              return index >= args[0] && index <= args[1];
            };
        case "first":
            return function(element, index, array) {
              return index == 0;
            };
        default:
            return function(element, index, array) {
              return true;
            };
    }
};

Nanochart.prototype._update = function(action, chartName, series) {
    $.each(this.charts, function(key, chart) {
        if (key === chartName) {
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

Nanochart.prototype._getData = function(table, series) {
    try {
        return {
            labels: this.database[table].labels,
            series: [this.database[table].series[series]]
        }
    } catch (e) {
        console.log(e);
        return undefined;
    }     
};

Nanochart.prototype._sparklineOptions = function(table, charttype) {
    var options = {
        axisX: {
            showLabel: false,
            offset: 0
        },
        axisY: {
            showLabel: false,
            offset: 0
        },
        high: this.database[table].max,
        low: this.database[table].min,
        width: this.database[table].labels.length * 6,
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

Nanochart.prototype._figureOptions = function(table, charttype) {
    var options = {
        high: this.database[table].max,
        low: this.database[table].min,
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
};

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
            length = chart.data.labels.length,
            cellWidth = ( right - left ) / (length - 1);
            
        if (charttype === 'bar')
            cellWidth = ( right - left ) / length;

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
};

(function(file) {
    var csvParser = function(lines) {
        var database = {},
            table = {};
        while(lines.length > 0) {
            /* current line */
            var line = lines.shift();
            /* line contains only table name */
            if (line.length == 1) {
                table = {};
                /* line contains only table name */
                database[line.shift()] = table;
                /* get next line */
                if (lines.length > 0) {
                    var nextline = lines.shift();
                    table.unit = nextline.shift();
                    table.labels = nextline;
                    table.series = {};
                }
            } else {
                /* add series */
                var key = line.shift();
                line = line.map(function(num) {
                    return parseFloat(num);
                });
                table.series[key] = line;

                if (table.max != undefined 
                    && table.min != undefined) {
                    line.push(table.max);
                    line.push(table.min);
                }
                table.max = Math.max(...line);
                table.min = Math.min(...line);
            }
        }
        return database;
    };
    var optionParser = function(data) {
        var option = {},
            re = /^([^:]+:[^;]+;)+$/;
        data = data.charAt(data.length - 1) === ';' ? data : data + ';';
        if (re.test(data)) {
            var arr = data.trim().split(/\s*;\s*/);
            arr.pop();
            arr.forEach(function(el) {
                var pair = el.split(/\s*:\s*/);
                option[pair[0]] = pair[1];
            });
        } else {
            console.log('invalid options!');
        }
        return option;
    };
    $.ajax({
        url: file,
        timeout: 3000,
        error: function() {
            console.log('Can not load CSV file!');
        },
        success: function(data) {
            var nanochart, database;
            var lines = data.split('\n').map(function(line) {
                return line.trim().split(',');
            });
            database = csvParser(lines);
            nanochart = new Nanochart(database);
            $('nc-sparkline').each(function() {
                var el = $(this)[0],
                    option = optionParser(el.dataset.option);
                nanochart.addSparkline(el, option.id, option.table, 
                    option.series, option.charttype);
            });
            $('nc-figure').each(function() {
                var el = $(this)[0],
                    option = optionParser(el.dataset.option);
                nanochart.addFigure(el, option.id, option.table, 
                    option.series, option.charttype);
            });
            $('nc-link').each(function() {
                var el = $(this)[0];
                var option = optionParser(el.dataset.option);
                nanochart.addLink($(this), option.chart, 
                    option.series, Nanochart.dataFilter(option.filter));
            });
        }
    });
})('csv/data.csv');