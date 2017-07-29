class Nanochart {
    constructor(database) {
        this.database = database;
        this.charts = {};
    }
    /**
     * draw word size chart and add it to entity
     *
     * @param    {HTMLElement}  el         mount node
     * @param    {string}       chartid    chart name   
     * @param    {string}       table      table name
     * @param    {string}       series     series name
     * @param    {string}       charttype  bar, line or pie
     * @returns  this
     */
    addSparkline(el, chartid, table, series, charttype) {
        let data, options, chart;
        table = this.database[table];
        if (table) {
            data = {
                labels: table.labels,
                series: [table.series[series]]
            };
            options = this._sparklineOptions(table, charttype);
            if (charttype === 'bar')
                chart = new Chartist.Bar(el, data, options);
            else if (charttype === 'line')
                chart = new Chartist.Line(el, data, options);
            /* add tool-tip */
            chart.on('created', (context) => {
                this._animateSparkline(chart, charttype);
                let span = $(el).find('.nc-maxmin');
                if(span.length == 0) {
                    span = $('<span class="nc-maxmin">' + table.max + '<br>'
                        + table.min + '</span>');
                    $(el).append(span).css('margin-right', span.outerWidth() + 'px');
                }
            });
            chart.table = table;
            chart.type = 'sparkline';
            this.charts[chartid] = chart;
        }
        return this;
    }
    /**
     * draw normal size chart and add it to entity
     *
     * @param    {HTMLElement}  el         mount node
     * @param    {string}       chartid    chart name   
     * @param    {string}       table      table name
     * @param    {string}       series     series name
     * @param    {string}       charttype  bar, line or pie
     * @returns  this
     */
    addFigure(el, chartid, table, series, charttype) {
        let data, options, chart;
        table = this.database[table];
        if (table) {
            data = {
                labels: table.labels,
                series: [table.series[series]]
            };
            options = this._figureOptions(table, charttype);
            if (charttype === 'bar')
                chart = new Chartist.Bar(el, data, options);
            else if (charttype === 'line')
                chart = new Chartist.Line(el, data, options);
            chart.on('created', (context) => {
                this._animateFigure(chart, charttype);
                let legend = $(el).find('.nc-figure-legend');
                if(legend.length == 0) {
                    let ul = $('<div class="nc-figure-legend"></div>');
                    ul.append($('<span></span>').html(series))
                        .append($('<span></span>').hide());
                    $(el).prepend(ul);
                }
            });
            chart.table = table;
            chart.type = 'figure';
            this.charts[chartid] = chart;
        }
        return this;
    }
    /**
     * add user interaction
     *
     * @param    {jQuery}   el      jQuery node
     * @param    {string}   targets chart name
     * @param    {string}   series  series name
     * @param    {function} filter  filter function
     * @returns  this
     */
    addLink($el, targets, series, filter) {
        let fn = (action) => {
            for (let target of targets) {
                let chart = this.charts[target];
                this._update(action, chart, series, filter);
                if (chart.type === 'figure') {
                    let list = $(chart.container).find('.nc-figure-legend span');
                    list.first().html((action === 'replace')? series : undefined);
                    list.last().html((action === 'add')? series : '');
                    if (action === 'add') {
                        list.last().show();
                    } else {
                        list.last().hide();
                    }
                }
            } 
        };
        $el.hover(() => fn('add'), () => fn('remove'));
        $el.click(() => fn('replace')); 
    }

    _update(action, chart, series, filter) {
        let data = chart.data;
        series = chart.table.series[series];
        if (filter) {
            series = series.map((element, index, array) => {
                if (filter(element, index, array)) 
                    return element;
            });
        }
        if (action === 'add') {
            data.series.push(series);
        } else if (action === 'remove' && data.series.length > 1) {
            data.series.pop();
        } else if (action === 'replace') {
            data.series = [series];
        }
        chart.update(data);
    }

    _sparklineOptions(table, charttype) {
        let options = {
            axisX: {
                showLabel: false,
                offset: 0
            },
            axisY: {
                showLabel: false,
                offset: 0
            },
            high: table.max,
            low: table.min,
            width: table.labels.length * 6,
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
    }

    _figureOptions(table, charttype) {
        let options = {
            high: table.max,
            low: table.min,
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
    }

    _animateSparkline(chart, charttype) {
        let self      = this,
            sparkline = $(chart.container),
            tooltip   = sparkline.find('.nc-sparkline-label'),
            line      = sparkline.find('.ct-grids .ct-horizontal').first(),
            labels    = chart.data.labels || [],
            data      = chart.data.series || [],
            svg       = $(chart.svg.getNode());

        if (tooltip.length == 0)
            tooltip = $('<span class="nc-sparkline-label"></span>').hide();
        sparkline.append(tooltip);

        svg.mousemove(function(event) {
            let x         = event.clientX - svg.offset().left,
                length    = chart.data.labels.length,
                cellWidth = parseInt(svg.attr('width')) / length,
                index     = Math.floor( x / cellWidth ),
                label     = labels[index] || 0,
                value     = data[0][index] || 0;

            if (charttype === 'line')
                cellWidth = parseInt(svg.attr('width')) / (length - 1);

            line.attr('x1', x).attr('x2', x)
                .attr('y1', 0).attr('y2', svg.attr('height')).show();
            tooltip.css({
                "left": event.clientX - tooltip.outerWidth() / 2 + "px",
                "top": svg.offset().top - tooltip.outerHeight() + "px"
            });
            tooltip.html(label + ': ' + value + ' ' + chart.table.unit).show();
        });

        svg.mouseleave(function() {
            tooltip.hide();
        });
    };

    _animateFigure(chart, charttype) {
        let self    = this,
            figure  = $(chart.container),
            tooltip = figure.find('.nc-tooltip');
            
        if (tooltip.length == 0)
            tooltip = $('<div class="nc-tooltip"></div>').hide();
        figure.append(tooltip);

        let grid   = figure.find('.ct-grid-background'),
            left   = parseInt(grid.attr('x')),
            top    = parseInt(grid.attr('y')),
            right  = parseInt(grid.attr('width')) + left,
            bottom = parseInt(grid.attr('height')) + top,
            svg    = $(chart.svg.getNode());

        svg.mousemove(function(event) {
            let x = event.clientX - svg.offset().left,
                y = event.clientY - svg.offset().top,
                length = chart.data.labels.length,
                cellWidth = ( right - left ) / (length - 1);
                
            if (charttype === 'bar')
                cellWidth = ( right - left ) / length;

            let index = Math.floor( ( x - left ) / cellWidth ),
                line  = figure.find('.ct-grids .ct-horizontal').first(),
                label = chart.data.labels[index],
                data  = chart.data.series[0][index] || 0;

            if (x >= left && x <= right
                && y > top && y < bottom) {
                tooltip.html(label + ': ' + data + ' ' + chart.table.unit);
                tooltip.show();
                line.attr('x1', x).attr('x2', x).attr('y1', top).show();
            } else {
                line.hide();
                tooltip.hide();
            }
            
            tooltip.css('left', x - tooltip.outerWidth() / 2 + 'px');
        });
    }

    _animatePieChart(container, tooltip, labels, data) {
        tooltip.html(labels[0] + '<br>' + data[0]);
        container.append(tooltip);

        let pie = container.find('.ct-series');
        pie.each(function(index, g) {
            $(this).mouseenter(function() {
                $(this).addClass('nc-pie-highlighted');
                tooltip.html(labels[index] + '<br>' + data[index]);
            });
            $(this).mouseleave(function() {
                $(this).removeClass('nc-pie-highlighted');
            });
        });
    }
}

(function(file) {
    let csvParser = function(lines) {
        let database = {},
            table = {};
        while(lines.length > 0) {
            /* current line */
            let line = lines.shift();
            /* line contains only table name */
            if (line.length == 1) {
                table = {};
                /* line contains only table name */
                database[line.shift()] = table;
                /* get next line */
                if (lines.length > 0) {
                    let nextline = lines.shift();
                    table.unit = nextline.shift();
                    table.labels = nextline;
                    table.series = {};
                }
            } else {
                /* add series */
                let key = line.shift();
                line = line.map((num) => {
                    return parseFloat(num);
                });
                table.series[key] = line;
                let max = Math.max(...line);
                let min = Math.min(...line);
                table.max = table.max ? Math.max(max, table.max) : max;
                table.min = table.min ? Math.min(min, table.min) : min;
            }
        }
        return database;
    };
    let optionParser = function(data) {
        let option = {},
            re = /^([^:]+:[^;]+;)+$/;
        data = data.charAt(data.length - 1) === ';' ? data : data + ';';
        if (re.test(data)) {
            let token = data.trim().split(/\s*;\s*/);
            /* last element is empty */
            token.pop();
            for (let el of token) {
                let pair = el.split(/\s*:\s*/);
                option[pair[0]] = pair[1];
            }
        } else {
            console.log('invalid options!');
        }
        return option;
    };
    let dataFilter = function(filter) {
        let fn, args, token = [];
        if (filter) {
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
        }
        switch(fn) {
            case "index":
                return (element, index, array) => {
                  return args.includes(index);
                };
            case "slice":
                return (element, index, array) => {
                  return index >= args[0] && index <= args[1];
                };
            case "first":
                return (element, index, array) => {
                  return index == 0;
                };
            case "last":
                return (element, index, array) => {
                  return index == array.length - 1;
                };
            default:
                return (element, index, array) => {
                  return true;
                };
        }
    };
    $.ajax({
        url: file,
        timeout: 3000,
        error: function() {
            console.log('Can not load CSV file!');
        },
        success: (data) => {
            let nanochart, database;
            let lines = data.split('\n').map((line) => {
                return line.trim().split(',');
            });
            database = csvParser(lines);
            nanochart = new Nanochart(database);
            $('nc-sparkline').each(function() {
                let el = $(this)[0];
                let option = optionParser(el.dataset.option);
                nanochart.addSparkline(el, option.id, option.table, 
                    option.series, option.charttype);
            });
            $('nc-figure').each(function() {
                let el = $(this)[0];
                let option = optionParser(el.dataset.option);
                nanochart.addFigure(el, option.id, option.table, 
                    option.series, option.charttype);
            });
            $('nc-link').each(function() {
                let el = $(this)[0];
                let option = optionParser(el.dataset.option);
                let charts = option.chart.split(",")
                    .map((chart) => {
                        return chart.trim()
                    });
                nanochart.addLink($(this), charts, option.series, 
                    dataFilter(option.filter));
            });
        }
    });
})('csv/data.csv');