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
    /* el: DOM element */
    parseView: function(el) {
        var view = {};
        var option = el.dataset.option;      
        option = option.charAt(option.length - 1) === ';' ? option : option + ';';
        var re = /^([^:]+:[^;]+;)+$/;
        if (re.test(option)) {
            var arr = option.trim().split(/\s*;\s*/);
            arr.pop();
            arr.forEach(function(el) {
                var pair = el.split(/\s*:\s*/);
                view[pair[0]] = pair[1];
            });
        } else {
            app.notification('Wrong options!', 'danger');
        }
        view.class = el.nodeName.toLowerCase().replace('app-', '');
        return view;   
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
    /* show figure */
    show: 'show',
    /* insert new figure into new line */
    insert: 'insert',
    /* pop up new figure */
    popup: 'popup',
    /* reset to default status */
    reset: 'reset',
    /* delete figure from app.store and DOM */
    delete: 'delete'
};

app.defaultOption = {
    text: {
        onHover: app.actionType.highlight,
        onClick: app.actionType.show
    },
    sparkline: {
        onHover: app.actionType.show,
        onClick: app.actionType.insert
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
        $el.click(this._mouseclick($el, view));
    },
    _mousehover: function(view) {
        var charts = [];
        return {
            mouseenter: function () {
                app.store.forEach(function(chart) {
                    if (chart.view.table === view.table 
                        && chart.view.series === view.series) {
                        charts.push(chart);
                        chart.highlight(view);
                    }
                });
            },
            mouseleave: function () {
                charts.forEach(function(chart) {
                    chart.reset();
                });
            }
        }
    },
    _mouseclick: function($el, view) {
        var action = view.onClick;
        return function () {
            var elementFound = false;
            app.store.forEach(function(chart) {
                if (chart.view.table === view.table
                    && chart.view.class === 'figure') {
                    elementFound = true;
                    chart.update(view);
                    chart.show();
                }
            });
            /* figure is not found, create new one */
            if (!elementFound) {
                if (view.onClick == app.actionType.insert) {
                    view.class = 'figure';
                    view.onClick = undefined;
                    view.onHover = undefined;
                    var container = document.createElement("DIV");
                    app.store.push(new app.Chart(container, new app.View(view)));
                    $(container).hide();
                    $el.after(container);
                    $(container).fadeIn();
                }
            }
        }
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
    this.onHover = view.onHover || app.defaultOption[this.class].onHover;
    this.onClick = view.onClick || app.defaultOption[this.class].onClick;
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
    if (this.view.class === 'figure')
        this.labels = this._getLabels();
    this.chart = this._getChart();
    /* mutable status */
    this.props = {
        highlighted: []
    }
}

app.Chart.prototype._getLabels = function() {
    var self = this;
    var $root = $(this.mountNode);
    var $ul = $('<ul class="app-label"></ul>');
    $root.append($ul);
    var labels = Object.keys(app.database[this.view.table].series);
    labels.forEach(function(label) {
        var $li = $('<li>' + label + '</li>');
        $li.click(function() {
            if ( !$(this).hasClass('active') ) {
                $(this).siblings().removeClass('active');
                $(this).addClass('active');
                self.update({
                    table: self.view.table,
                    series: label
                });
            }          
        });
        $ul.append($li);
    });
    return $ul;
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
        var chart = new Chartist.Bar(self.mountNode, data, options)
        chart.on('draw', function(context) {
            $(context.element._node).addClass('dark-grey');
        });
        return chart;
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
            high: 20,
            low: 0,
            seriesBarDistance: 0
        }
        var chart = new Chartist.Bar(self.mountNode, data, options);
        chart.on('draw', function(context) {
            var node = $(context.element._node);
            if (node.hasClass('ct-bar'))
                $(context.element._node).addClass('dark-grey');
        });
        /* change to corrected class according to series index */
        chart.on('created', function(context) {
            var $svg = $(context.svg.getNode());
            var keys = Object.keys(table.series);
            var n = keys.indexOf(view.series);
            var index = String.fromCharCode(97 + n);
            $svg.find('.ct-series-a').removeClass('ct-series-a').addClass('ct-series-' + index);
        });
        return chart;
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

app.Chart.prototype.highlight = function(view) {
    var self = this;
    view.selected = app.dataFilter.do(view);
    /* convert DOM object to jQuery Object */
    var $bars = $(self.chart.container).find('line.ct-bar');
    $bars.each(function(index) {
        if (view.selected.includes(index)) {
            self.props.highlighted.push($(this));
            $(this).removeClass('dark-grey');
        }
    });
}

app.Chart.prototype.show = function() {
    $(this.mountNode).fadeIn();
}

app.Chart.prototype.reset = function() {
    this.props.highlighted.forEach(function(el) {
        el.addClass('dark-grey');
    });
    this.props.highlighted = [];
}

app.Chart.prototype.update = function(view) {
    this.view.series = view.series;
    var table = app.database[view.table];
    var data = {
        labels: table.labels,
        series: [table.series[view.series]]
    };
    this.chart.update(data);
}

app.loadCSV('papers', 'csv/data.csv', function() {
    /* initial process */
    /* draw sparklines and save view model */
    $('app-sparkline, app-figure, app-text').each(function(i) {
        var el   = $(this)[0];
        var view = app.parseView(el);
        if (view) {
            if (view.class === 'text') {
                app.dispatcher.eventHandler($(this), new app.View(view));          
            } else {
                /* pass DOM element directly as mount point*/
                var f = new app.Chart(el, new app.View(view));
                app.store.push(f);
            }         
        }
        
    });
});