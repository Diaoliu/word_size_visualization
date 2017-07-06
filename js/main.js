"use strict";
/* avoid existed name-space */
var app = {};
var app = {
    notification: function (msg, status) {
        UIkit.notification({
          message: msg,
          status: status,
          pos: 'bottom-center',
          timeout: 5000
        });
    },
    parseAttr: function(str) {
        var attr = {};
        str = str.charAt(str.length - 1) === ';' ? str : str + ';';
        var re = /^([^:]+:[^;]+;)+$/;
        if (re.test(str)) {
            var arr = str.trim().split(/\s*;\s*/);
            arr.pop();
            console.log(arr);
            arr.forEach(function(el) {
                var pair = el.split(/\s*:\s*/);
                attr[pair[0]] = pair[1];
            });
        } else {
            app.notification('Wrong options!', 'danger');
        }
        return attr;   
    },
    loadCSV: function (name, file, callback) {
        Papa.parse(file, {
            download: true,
            error: function(err) {
                app.notification(err, 'danger');
            },
            complete: function(results) {
                var data     = results.data;
                var dataset  = {};
                var firstLine = data.shift();
                /* convert data format */
                firstLine.shift();
                dataset.labels = firstLine;
                dataset.series = {};
                data.forEach(function(line) {
                    var key = line.shift();
                    var value = line.map(function(el) {
                        return parseFloat(el);
                    });
                    dataset.series[key] = value;
                });
                /* add to global data collections */
                app.dataset[name] = dataset;
                /* call initial process */
                callback();
            }
        });
    }
};

/* data model */
app.dataset = {};

app.dataFilter = {
    do: function(dataset, series, filter, args) {
        var selected = [];
        var arr = app.dataset[dataset].series[series];
        var selector = function (fn) {
            $.each(arr, function(key, value) {
                if (fn(arr, key, value, args))
                    selected.push(key);
            });
        };
        if (filter === 'index') {
            selected = args;
        } else if (filter === 'slice')  {
            for (var i = args[0]; i <= args[1]; i++)
                selected.push(i);
        } else if (filter === 'first')  {
            selected = [0];
        } else if (filter === 'last')  {
            selected = [arr.length - 1];
        } else if(filter) {
            selector(this._filter[filter]);
        } else {
            /* filter is undefined, select all elements */
            for (var i = 0; i <= arr.length; i++)
                selected.push(i); 
        }
        return selected;
    },
    addFilter: function (name, fn) {
        if (!this._filter[name]) {
             this._filter[name] = fn;
        }    
    },
    _filter: {
        max: function(arr, key, value) {
            var max = Math.max.apply(Math,arr);
            return value == max;
        },
        min: function(arr, key, value) {
            var min = Math.min.apply(Math,arr);
            return value == min;
        },
        smaller: function(arr, key, value, args) {
            return value < args[0];
        },
        larger: function(arr, key, value, args) {
            return value > args[0];
        },
        equal: function(arr, key, value, args) {
            return value === args[0];
        }
    }
};
/* singleton object */
app.store = {
    figures: [],
    sparklines: []
};
/**
 * @brief Target class
 * @dataset string
 * @series string
 * @selected array of index
 */
app.Target = function(dataset, series, selected) {
    this.dataset = dataset;
    this.series = series;
    this.selected = selected;
}

app.actionType = {
    /* highlight selected data */
    highlight: 'highlight',
    /* switch figure content */
    update: 'switch',
    /* show enlarged figure */
    enlarge: 'enlarge',
    /* reset to default status */
    reset: 'reset'
};

app.defaultAction = {
    text: {
        onHover: app.actionType.highlight,
        onClick: app.actionType.update
    },
    sparkline: {
        onHover: app.actionType.update,
        onClick: app.actionType.enlarge
    },
    figure: {
        onHover: undefined,
        onClick: undefined
    }
};
/**
 * @brief Action dispatcher
 */
app.dispatcher = {
    getEventHandler: function(action) {
        if (action.event === 'mouseHover')
            return this._onMouseHover(action);
        else if (action.event === 'mouseClick')
            return this._onMouseClick(action);
    },
    _onMouseHover: function(action) {
        var target = action.target;
        var charts = [];
        return {
            mouseenter: function () {
                app.store.sparklines.forEach(function(sparkline) {
                    if (sparkline.dataset === target.dataset 
                        && sparkline.series === target.series) {
                        charts.push(sparkline);
                        sparkline.update(action.actionType, target.selected);
                    }
                });
            },
            mouseleave: function () {
                app.store.sparklines.forEach(function(sparkline) {
                    charts.forEach(function(chart) {
                        chart.update(app.actionType.reset);
                    });
                });
            } 
        }
    },
    _onMouseClick: function(action) {
        // body...
    }
};
/**
 * @brief Action class
 * @event jQuery object
 * @actionType jQuery object
 * @target raw string need to be parsed
 */
app.Action = function(event, actionType, target) {
    this.event      = event;
    this.actionType = actionType;
    this.target     = this._parseTarget(target);
}

app.Action.prototype._parseTarget = function(str) {
    var tokens;
    var dataset;
    var series;
    var filterName;
    var args;
    try {
        tokens = str.split('|').map(function(token) {
            return token.trim();
        });
        dataset = tokens[0];
        series = tokens[1];
        if (tokens.length === 3) {
            var fn = tokens[2].split(/\(|\)/);
            filterName = fn[0];
            if (fn.length == 3) {
                args = fn[1].split(',').map(function(arg) {
                    return parseFloat(arg.trim());
                });
            } 
        }   
        var selected = app.dataFilter.do(dataset, series, filterName, args);
        return new app.Target(dataset, series, selected);
    } catch(err) {
        app.notification(err + ' Can not parse target!', 'danger');
    }
};
/**
 * @brief Sparkline class: word-scale charts
 * @mountNode DOM object
 * @set table name
 * @series row name in a table
 * @charttype bar, line, pie
 */
app.Sparkline= function(mountNode, set, series, charttype) {
    /* static props */
    this.mountNode = mountNode;
    this.dataset = set;
    this.series = series;
    this.charttype = charttype;
    this.chart = this._getChart();
    /* mutable status */
    this.props = {
        highlighted: []
    }
}

app.Sparkline.prototype.update = function(action, selected) {
    var self = this;
    if (action === app.actionType.highlight) {
        /* convert DOM object to jQuery Object */
        var $bars = $(this.chart.container).find('line.ct-bar');
        $bars.each(function(index) {
            if (selected.includes(index)) {
                self.props.highlighted.push($(this));
                $(this).removeClass('dark-grey');
            }
        });
    } else if (action === app.actionType.reset) {
        self.props.highlighted.forEach(function(el) {
            el.addClass('dark-grey');
        });
        self.props.highlighted = [];
    }
    
}

app.Sparkline.prototype._getChart = function() {
    var self = this;
    var dataset = app.dataset[self.dataset];
    var table = [];
    $.each(dataset.series, function(key, value) {
        table.push(key === self.series ? value : []);
    })
    var data = {
        labels: dataset.labels,
        series: table
    };
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
        width: data.labels.length * 6,
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
    if (this.charttype === 'bar') {
        return new Chartist.Bar(self.mountNode, data, options);
    } else if (this.charttype === 'line') {
        options.showPoint = false;
        options.lineSmooth = false;
        options.chartPadding.top = 5;
        options.chartPadding.bottom = 5;
        options.fullWidth = true;
        return new Chartist.Line(self.mountNode, data, options);
    }
};

app.Figure = function(mountNode, table, rows, charttype) {
    this.mountNode = mountNode;
    this.dataset = table;
    this.charttype = charttype;
    this.chart = this._getChart(rows);
    /* mutable status */
    this.props = {
        visible: true
    }
}

app.Figure.prototype._getChart = function(rows) {
    var set = app.dataset[this.dataset];
    var series = [];
    $.each(set.series, function(key, value) {
        series.push(rows.includes(key) ? value : []);
    });
    var data = {
        labels: set.labels,
        series: series
    };
    if (this.charttype === 'bar') {
        options = {
            seriesBarDistance: 0
        }
        this.chart = new Chartist.Bar(this.mountNode, data, options);
    } else if (this.charttype === 'line') {
        var options = {
            lineSmooth: false,
            fullWidth: true,
            showArea: true,
            chartPadding: {
                right: 50
            }
        }
        this.chart = new Chartist.Line(this.mountNode, data, options);
    }
};

app.loadCSV('papers', 'csv/data.csv', function() {
    /* initial process */
    /* draw sparklines and save view model */
    $('tc-sparkline').each(function(i) {
        var el      = $(this);
        var set     = el.data('set');
        var series  = el.data('series');
        var charttype = el.data('charttype');
        /* pass DOM element directly as mount point*/
        var s       = new app.Sparkline(el[0], set, series, charttype);
        /* change bar colour */
        s.chart.on('draw', function(context) {
            context.element.addClass('dark-grey');
        });
        app.store.sparklines.push(s);
    });
    /* draw figures and save view model */
    $('tc-figure').each(function(i) {
        var el      = $(this);
        var table     = el.data('set');
        var rows    = el.data('show').split(',').map(function(item) {
            return item.trim();
        });
        var charttype = el.data('charttype');
        var s         = new app.Figure(el[0], table, rows, charttype);
        app.store.figures.push(s);
    });
    /* create semantic connections */
    $('tc-text').each(function(i) {
        var $node = $(this);
        var target = $node.data('target');
        var hoverAction = $node.data('onHover') || app.defaultAction.text.onHover;
        var clickAction = $node.data('onClick') || app.defaultAction.text.onClick;
        var handler = app.dispatcher.getEventHandler(
            new app.Action('mouseHover', hoverAction, target
        )); 
        $node.hover(handler.mouseenter, handler.mouseleave);
    });
});