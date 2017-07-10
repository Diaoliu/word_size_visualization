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
/* singleton object */
app.store = [];

app.dataFilter = {
    do: function(view) {
        var selected = [];
        var arr = app.database[view.table].series[view.series];
        var selector = function (fn) {
            $.each(arr, function(key, value) {
                if (fn(key, value, arr, view.filterArgs))
                    selected.push(key);
            });
        };
        var filter = this._filter[view.filter];
        if (filter) {
            selector(filter);
        }
        return selected;
    },
    addFilter: function (name, fn) {
        if (!this._filter[name]) {
             this._filter[name] = fn;
        }    
    },
    _filter: {
        index: function(key, value, arr, args) {
            return args.includes(key);
        },
        slice:function(key, value, arr, args) {
            return key >= args[0] && key <= args[1];
        },
        first:function(key, value, arr, args) {
            return key == 0;
        },
        last:function(key, value, arr, args) {
            return key == arr.length - 1;
        },
        max: function(key, value, arr, args) {
            var max = Math.max.apply(Math,arr);
            return value == max;
        },
        min: function(key, value, arr, args) {
            var min = Math.min.apply(Math,arr);
            return value == min;
        },
        smaller: function(key, value, arr, args) {
            return value < args[0];
        },
        larger: function(key, value, arr, args) {
            return value > args[0];
        },
        equal: function(key, value, arr, args) {
            return value === args[0];
        }
    }
};

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
    eventHandler: function($el, view) {
        if (view.filter) {
            this._parseFilter(view);
        }
        var hoverHandler = this._mousehover(view);
        $el.hover(hoverHandler.mouseenter, hoverHandler.mouseleave);
        $el.click(this._mouseclick(view));
    },
    _mousehover: function(view) {
        var charts = [];
        return {
            mouseenter: function () {
                app.store.forEach(function(chart) {
                    if (chart.view.table === view.table 
                        && chart.view.series === view.series) {
                        charts.push(chart);
                        chart.update(view.onHover, view);
                    }
                });
            },
            mouseleave: function () {
                charts.forEach(function(chart) {
                    chart.update(app.actionType.reset);
                });
            } 
        }
    },
    _mouseclick: function(view) {
        return function () {
            app.store.forEach(function(chart) {
                if (chart.view.table === view.table
                    && chart.view.class === "figure") {
                    chart.update(view.onClick, view);
                }
            });
        };
    },
    _parseFilter: function(view) {
        var filter = view.filter;
        var token = [];
        /* remove all white spaces */
        filter = filter.replace(/\s+/g, "");
        /* valid filter syntax */
        if(/^[A-Za-z_]\w*\(\d*(,\d+)*\)/.test(filter)) {
            token = filter.split(/\(|\)/);
            token = token.filter(function(el) {
                return el != "";
            });
            view.filter = token.shift();
            if (token.length != 0) {
                view.filterArgs = token[0].split(",");
            }
        }
    }
};

app.View = function(view) {
    this.class = view.class;
    this.charttype = view.charttype;
    this.onHover = view.onHover || app.defaultAction[this.class].onHover;
    this.onClick = view.onClick || app.defaultAction[this.class].onClick;
    this.table = view.table;
    this.series = view.series;
    this.filter = view.filter;
    this.filterArgs = [];
    this.selected = [];
}
/**
 * @brief Char class: sparkline and figure
 * @mountNode DOM object
 * @view app.View 
 */
app.Chart = function (mountNode, view) {
    this.mountNode = mountNode;
    this.view = view;
    this.chart = this._getChart();
    /* mutable status */
    this.props = {
        highlighted: []
    }
}

app.Chart.prototype._getChart = function() {
    if (this.view.class === 'sparkline')
        return this._getSparkline();
    if (this.view.class === 'figure')
        return this._getFigure();
}

app.Chart.prototype._getSparkline = function() {
    var self = this;
    var view = self.view;
    var table = app.database[view.table];
    var data = {
        labels: table.labels,
        series: [table.series[view.series]]
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
    if (view.charttype === 'bar') {
        return new Chartist.Bar(self.mountNode, data, options);
    } else if (view.charttype === 'line') {
        options.showPoint = false;
        options.lineSmooth = false;
        options.chartPadding.top = 5;
        options.chartPadding.bottom = 5;
        options.fullWidth = true;
        return new Chartist.Line(self.mountNode, data, options);
    }
}

app.Chart.prototype._getFigure = function() {
    var self = this;
    var view = self.view;
    var table = app.database[view.table];
    var data = {
        labels: table.labels,
        series: [table.series[view.series]]
    };
    if (view.charttype === 'bar') {
        var options = {
            seriesBarDistance: 0
        }
        return new Chartist.Bar(self.mountNode, data, options);
    } else if (view.charttype === 'line') {
        var options = {
            lineSmooth: false,
            fullWidth: true,
            showArea: true,
            chartPadding: {
                right: 50
            }
        }
        return new Chartist.Line(self.mountNode, data, options);
    }
}

app.Chart.prototype.update = function(action, view) {
    var self = this;
    if (action === app.actionType.highlight) {
        view.selected = app.dataFilter.do(view);
        /* convert DOM object to jQuery Object */
        var $bars = $(self.chart.container).find('line.ct-bar');
        $bars.each(function(index) {
            if (view.selected.includes(index)) {
                self.props.highlighted.push($(this));
                $(this).addClass('highlighted');
            }
        });
    } else if (action === app.actionType.update) {
        self.view.series = view.series;
        var table = app.database[view.table];
        var data = {
            labels: table.labels,
            series: [table.series[view.series]]
        };
        self.chart.update(data);
    } else if (action === app.actionType.reset) {
        self.props.highlighted.forEach(function(el) {
            el.removeClass('highlighted');
        });
        self.props.highlighted = [];
    }
}

app.loadCSV('papers', 'csv/data.csv', function() {
    /* initial process */
    /* draw sparklines and save view model */
    $('.app-text, .app-sparkline, .app-figure').each(function(i) {
        var el     = $(this)[0];
        var option = el.dataset.option;
        var view   = app.parseAttr(option);
        view.class = el.className.match(/app-\w*/)[0].replace("app-", "");
        if (view) {
            if (view.class === 'sparkline' || view.class === 'figure') {
                /* pass DOM element directly as mount point*/
                var s = new app.Chart(el, new app.View(view));
                app.store.push(s);
            } else {
                app.dispatcher.eventHandler($(this), new app.View(view));
            }         
        }
        
    });
});