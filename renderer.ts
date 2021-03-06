///<reference path="../../../public/app/headers/common.d.ts" />
///<reference path="./lib/d3.d.ts" />

import $  from 'jquery';
import _  from 'lodash';
import d3 from './lib/d3';

class KPITooltip {
  $location: any;
  $timeout:  any;

  elem: any;

  constructor($location, $timeout) {
    this.$location = $location;
    this.$timeout  = $timeout;
  };

  getElem() {
    if (this.elem) { return this.elem; }
    return this.elem = $('<div id="tooltip" class="graph-tooltip">');
  };

  removeElem() {
    if (this.elem) {
      this.elem.remove();
      this.elem = null;
    }
  };

  render(d) {
    var stateDesc = ['OK', 'WARNING', 'CRITICAL'];
    var state     = d.state;

    var fields = [
      ['Name', d.panel],
      ['State', stateDesc[state]],
      ['Thresholds', 'warning='+d.thresholds.warning+', '+'critical='+d.thresholds.critical],
    ];
    var metrics = _.chain(d.values[state])
      .map(metric => { return [metric.target, metric.value]; })
      .sortBy(metric => { return metric[1] })
      .value();
    if (!d.thresholds.reversed) { metrics.reverse(); }

    var template = _.template(''
      + '<% _.each(table, function(row) { %>'
      +   '<div class="kpi-list-item">'
      +     '<div class="kpi-field-name"><%= row[0] %></div>'
      +     '<div class="kpi-field-value"><%= row[1] %></div>'
      +   '</div>'
      + '<% }) %>'
    );
    return this.getElem().html(template({table: fields}) + '<hr/>' + template({table: metrics}));
  };

  onMouseover(d) {
    return this.render(d);
  };

  onMousemove(d) {
    return this.getElem().place_tt(d3.event.pageX + 20, d3.event.pageY);
  };

  onMouseout(d) {
    return this.removeElem();
  };

  onClick(d) {
    return this.$timeout(() => {
      this.removeElem();
      this.$location.url(d.uri);
    });
  };

  remove() {
    this.removeElem();
  };
};

export class KPIRenderer {
  colors = ['green', 'orange', 'red'];

  root:   any;
  private tooltip: KPITooltip;

  $location: any;
  $timeout:  any;

  constructor(root, $location, $timeout) {
    this.root      = root;
    this.$location = $location;
    this.$timeout  = $timeout;
  };

  calculateOffset(params) {
    var offset = {x: 0, y: 0};
    var colsUsed = 1, rowsUsed = 1;
    if (params.cells < params.cols) {
      colsUsed = params.cells;
      rowsUsed = 1;
    } else {
      colsUsed = params.cols;
      rowsUsed = Math.ceil(params.cells / colsUsed);
    }

    offset.x += (params.maxCols - colsUsed) / 2;
    offset.y += (params.maxRows - rowsUsed) / 2;

    return offset;
  };

  distributeCells(data, height, width) {
    var nearestRoot = Math.ceil(Math.sqrt(data.length));
    var rows = Math.ceil(nearestRoot * (height / width));
    var cols = Math.ceil(nearestRoot * (width  / height));

    var size   = Math.min((height / rows), (width / cols));
    var offset = this.calculateOffset({
      cells:   data.length,
      cols:    cols,
      rows:    rows,
      maxCols: (width  / size),
      maxRows: (height / size),
    });

    var curCol = offset.x, curRow = offset.y;
    var cells = _.map(data, datum => {
      var cell = _.extend({}, datum, {col: curCol, row: curRow});
      if (curCol === (cols + offset.x) - 1) {
        curCol = offset.x;
        curRow += 1;
      } else {
        curCol += 1;
      }
      return cell;
    });

    return {
      cells: cells,
      rows:  rows,
      cols:  cols,
      size:  size,
    };
  };

  render(data, height, width) {
    this.remove();

    var distribution = this.distributeCells(data, height, width);
    var gridSize     = distribution.size;
    var colors = this.colors;

    var kpi = d3.select(this.root[0])
      .append('svg')
        .attr('height', () => { return height; })
        .attr('width',  () => { return width;  })
      .append('g')
      .selectAll('.heatmap')
      .data(distribution.cells, d => { return d.col + ':' + d.row; })
      .enter().append('svg:rect')
        .attr('x',       d => { return d.col * gridSize; })
        .attr('y',       d => { return d.row * gridSize; })
        .attr('width',   d => { return gridSize;         })
        .attr('height',  d => { return gridSize;         })
        .style('fill',   d => { return colors[d.state];  });

    var tooltip = this.tooltip = new KPITooltip(this.$location, this.$timeout);
    kpi
      .on('mouseover', tooltip.onMouseover.bind(tooltip))
      .on('mousemove', tooltip.onMousemove.bind(tooltip))
      .on('mouseout',  tooltip.onMouseout.bind(tooltip))
      .on('click',     tooltip.onClick.bind(tooltip));
  };

  remove() {
    if (this.tooltip) {
      this.tooltip.remove();
    }
    if (this.root) {
      this.root.empty();
    }
  };
};
