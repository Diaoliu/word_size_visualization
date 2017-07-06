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
                app.database[name] = database;
                /* call initial process */
                callback();
            }
        });
    }
};

/* data model */
app.database = {};

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
app.Target = function(table, series, selected) {
    this.table = table;
    this.series = series;
    this.selected = selected;
}

app.actionType = {
    /* highlight selected data */
    highlight: 'highlight',
    /* switch figure content */
    update: 'update',
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
app.Action = function(event, options) {
    this.event      = event;
    this.actionType = options.onHover;
    this.target     = this._parseTarget(options);
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
app.Sparkline= function(mountNode, options) {
    /* static props */
    this.mountNode = mountNode;
    this.table = options.table || "";
    this.series = options.series || "";
    this.charttype = options.charttype || "";
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
    var table = app.database[self.table];
    var data = {
        labels: table.labels,
        series: [table.[self.series]]
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

app.Figure = function(mountNode, options) {
    this.mountNode = mountNode;
    this.table = options.table || "";
    this.series = options.series || "";
    this.charttype = options.charttype || "";
    this.chart = this._getChart();
    /* mutable status */
    this.props = {
        visible: true
    }
}

app.Figure.prototype._getChart = function() {
    var set = app.database[this.table];
    var data = {
        labels: set.labels,
        series: [table.[self.series]]
    };
    if (this.charttype === 'bar') {
        var options = {
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
    $('[app-sparkline]').each(function(i) {
        var el      = $(this);
        var attr    = el.attr('app-sparkline');
        var options = app.parseAttr(attr);
        if (options) {
            /* pass DOM element directly as mount point*/
            var s   = new app.Sparkline(el[0], options);
            app.store.sparklines.push(s);
        }
        
    });
    /* draw figures and save view model */
    $('[app-figure]').each(function(i) {
        var el      = $(this);
        var attr    = el.attr('app-sparkline');
        var options = app.parseAttr(attr);
        if (options) {
            var f   = new app.Figure(el[0], options);
            app.store.figures.push(f);
        }       
    });
    /* create semantic connections */
    $('[app-text]').each(function(i) {
        var $el   = $(this);
        var attr    = el.attr('app-sparkline');
        var options = app.parseAttr(attr);
        if (options) {
            if(!options.onHover)
                options.actionType = app.defaultAction.text.onHover;
            var handler = app.dispatcher.getEventHandler(
                new app.Action('mouseHover', options)); 
            $el.hover(handler.mouseenter, handler.mouseleave);
        }
    });
});