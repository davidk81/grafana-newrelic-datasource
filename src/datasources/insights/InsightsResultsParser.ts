import { each } from 'lodash';

export class InsightsResultsParser {
  output: any = {
    columns: [],
    rows: [],
    type: 'table',
  };
  private pushTimeSeriesResult(target: any, datapoints: any) {
    if (this.output.columns && this.output.rows) {
      this.output = [];
    }
    const o = { target, datapoints };
    this.output.push(o);
  }
  private handlePercentageResults(content: any, timeseriesData: any, timeshift: number, index: number) {
    console.log('percentage results');
    const t = (content.function || '') + ' (' + content.of.function + ` of ${content.filter})`;
    const d = timeseriesData.map((item: any) => [item.results[index].result, item.beginTimeSeconds * 1000 + timeshift]);
    this.pushTimeSeriesResult(t, d);
  }
  private handlePercentileResults(content: any, timeseriesData: any, timeshift: number, index: number) {
    console.log('percentile results');
    content.thresholds.forEach((threshold: any) => {
      const t = (content.attribute || '') + ' (' + threshold + ' %)';
      const d = timeseriesData.map((item: any) => [item.results[index].percentiles[threshold.toString()], item.beginTimeSeconds * 1000 + timeshift]);
      this.pushTimeSeriesResult(t, d);
    });
  }
  private handleHistogramResults(timeseriesData: any, timeshift: number, index: number) {
    console.log('Received Timeseries histogram');
    each(timeseriesData[0].results[0].histogram, (v: any, k: any) => {
      const t = k.toString();
      const d = timeseriesData.map((item: any) => [item.results[index].histogram[k.toString()], item.beginTimeSeconds * 1000 + timeshift]);
      this.pushTimeSeriesResult(t, d);
    });
  }
  private handleStepResults(content: any, timeseriesData: any, timeshift: number, index: number) {
    console.log('Step results');
    content.steps.forEach((step: any, stepIndex: number) => {
      const t = step;
      const d = timeseriesData.map((item: any) => [item.results[index].steps[stepIndex], item.beginTimeSeconds * 1000 + timeshift]);
      this.pushTimeSeriesResult(t, d);
    });
  }
  private handleSingleColumnFacetResults(metadata: any, facet: any, index: number) {
    let key = metadata.contents.timeSeries.contents[0].contents.function || 'count';
    key = key === 'uniquecount' ? 'uniqueCount' : key;
    const t = facet.name || index;
    const d = facet.timeSeries.map((item: any) => [item.results[0][key], item.beginTimeSeconds * 1000]);
    this.pushTimeSeriesResult(t, d);
  }
  private handleMultiColumnFacetResults(metadata: any, facet: any, index: number) {
    each(metadata.contents.timeSeries.contents, (content: any, cindex: number) => {
      let key = content.simple ? content.function : content.contents.contents ? content.contents.contents.function : content.contents.function;
      key = key === 'uniquecount' ? 'uniqueCount' : key;
      const t = (facet.name || index) + ' ' + (content.alias || key);
      const d = facet.timeSeries.map((item: any) => [item.results[cindex][key], item.beginTimeSeconds * 1000]);
      this.pushTimeSeriesResult(t, d);
    });
  }
  private handleRegularTimeseriesResutls(content: any, timeseriesData: any, timeshift: number, index: number, suffix: string) {
    console.log('Regular Timeseries');
    const title1 = content.alias || (content.contents ? content.contents.alias || content.contents.function : content.function);
    const title2 = suffix ? ` ( ${suffix.toLowerCase()} )` : '';
    const title = (title1 + title2).trim();
    const key = content.contents
      ? content.contents.contents
        ? content.contents.contents.function
        : content.contents.function
      : content.alias || content.function;
    const t = title;
    const d = timeseriesData.map((item: any) => [item.results[index][key] || item.results[index].result, item.beginTimeSeconds * 1000 + timeshift]);
    this.pushTimeSeriesResult(t, d);
  }
  private handleTimeseriesResult(metadata: any, timeseriesData: any, suffix: string, timeshift: number) {
    const timeseriesMetadata = metadata.timeSeries || metadata.contents.timeSeries;
    try {
      timeseriesMetadata.contents.forEach((content: any, index: number) => {
        {
          if (content && content.function === 'percentage' && content.simple) {
            this.handlePercentageResults(content, timeseriesData, timeshift, index);
          } else if (content && content.function === 'percentile') {
            this.handlePercentileResults(content, timeseriesData, timeshift, index);
          } else if (content && content.function === 'histogram') {
            this.handleHistogramResults(timeseriesData, timeshift, index);
          } else if (content.steps) {
            this.handleStepResults(content, timeseriesData, timeshift, index);
          } else {
            this.handleRegularTimeseriesResutls(content, timeseriesData, timeshift, index, suffix);
          }
        }
      });
    } catch (ex) {
      console.log('Error while parsing timeseries results');
    }
  }
  private handleFunnelTypeResults(responseData: any) {
    console.log('funnel Type');
    this.output.columns.push(
      {
        text: responseData.metadata.contents[0].attribute,
        type: 'string',
      },
      {
        text: 'value',
        type: typeof responseData.results[0].steps[0],
      }
    );
    each(responseData.metadata.contents[0].steps, (step: any, stepIndex: number) => {
      this.output.rows.push([step, responseData.results[0].steps[stepIndex]]);
    });
  }
  private handleEventsTypeResults(responseData: any) {
    console.log('events Type');
    this.output = {
      columns: [],
      rows: [],
      type: 'table',
    };
    const rows: any[] = [];
    let cols: any[] = [];
    each(responseData.results[0].events, (event: any) => {
      cols = [];
      const currRow: any[] = [];
      each(event, (v: any, k: any) => {
        if (k === 'timestamp') {
          cols.push({
            text: 'Time',
            type: typeof v,
          });
          currRow.push(v);
        }
      });
      each(event, (v: any, k: any) => {
        if (k !== 'timestamp') {
          cols.push({
            text: k,
            type: k === 'appId' ? 'string' : typeof v,
          });
          currRow.push(v);
        }
      });
      rows.push(currRow);
    });
    this.output.columns = cols;
    this.output.rows = rows;
  }
  private handleResultsTypeResults(responseData: any) {
    console.log('Results Type');
    this.output = {
      columns: [],
      rows: [],
      type: 'table',
    };
    each(responseData.metadata.contents, (content: any) => {
      this.output.columns = [];
      if (content.columns) {
        each(content.columns, (col: any) => {
          this.output.columns.push({
            text: col,
            type: typeof responseData.results[0].events[0][col],
          });
        });
      } else if (content.constant) {
        this.output.columns.push({
          text: content.alias || 'constant',
        });
      }
    });
    each(responseData.results[0].events, (row: any) => {
      const o: any[] = [];
      each(responseData.metadata.contents[0].columns, (col: any) => {
        o.push(row[col]);
      });
      this.output.rows.push(o);
    });
  }
  private handleTableResults(res: any) {
    console.log(`Received results in table format`);
    const totalResults: any[] = [];
    const facets = res.result.data.facets;
    const metadata = res.result.data.metadata;
    const title = metadata.facet;
    each(facets, (facet: any) => {
      const output: any = {};
      output[title] = facet.name;
      each(metadata.contents.contents, (content: any, index: number) => {
        let key = content.simple ? content.function : content.contents.contents ? content.contents.contents.function : content.contents.function;
        key = key === 'uniquecount' ? 'uniqueCount' : key;
        output[content.alias || content.function] = facet.results[index][key];
      });
      totalResults.push(output);
    });
    if (this.output.columns.length === 0) {
      each(totalResults[0], (v: any, k: any) => {
        this.output.columns.push({
          text: k,
          type: typeof v,
        });
      });
    }
    each(totalResults, (tempRes: any) => {
      const row: any[] = [];
      each(tempRes, (v: any, k: any) => {
        row.push(v);
      });
      this.output.rows.push(row);
    });
  }
  constructor(results: any[]) {
    try {
      results.forEach((res: any) => {
        const response = res.result;
        if (response && response.data && response.data.metadata) {
          const responseData = response.data;
          if (responseData.timeSeries || (responseData.current && responseData.current.timeSeries)) {
            console.log(`Received results in timeseries format`);
            if (responseData.timeSeries) {
              this.handleTimeseriesResult(responseData.metadata, responseData.timeSeries, '', 0);
            } else {
              if (responseData.current) {
                this.handleTimeseriesResult(responseData.metadata, responseData.current.timeSeries, '', 0);
              }
              if (responseData.previous) {
                const suffix = responseData.metadata.rawCompareWith || 'Previous';
                this.handleTimeseriesResult(responseData.metadata, responseData.previous.timeSeries, suffix, responseData.metadata.compareWith || 0);
              }
            }
          } else if (responseData.facets && responseData.facets[0] && responseData.facets[0].timeSeries) {
            console.log(`Received results in table with timeseries format`);
            if (this.output.columns && this.output.rows) {
              this.output = [];
            }
            const metadata = responseData.metadata;
            each(responseData.facets, (facet: any, index: number) => {
              if (metadata.contents.timeSeries.contents.length === 0) {
                this.handleSingleColumnFacetResults(metadata, facet, index);
              } else {
                this.handleMultiColumnFacetResults(metadata, facet, index);
              }
            });
          } else if (responseData.facets) {
            this.handleTableResults(res);
          } else if (responseData.results) {
            if (responseData.metadata.contents && responseData.metadata.contents[0]) {
              if (responseData.metadata.contents[0].function === 'funnel') {
                this.handleFunnelTypeResults(responseData);
              } else if (responseData.metadata.contents[0].function === 'events') {
                this.handleEventsTypeResults(responseData);
              }
            } else {
              this.handleResultsTypeResults(responseData);
            }
          }
        }
      });
    } catch (ex) {
      console.log('Error while parsing the results', ex);
    }
  }
}
