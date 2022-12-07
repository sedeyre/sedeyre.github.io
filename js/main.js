function xnsmn_chart() {

    const url2json = "https://sedeyre.github.io/json4datatable.json";
    var width =document.documentElement.clientWidth; // make chart responsive  
    var height = document.documentElement.clientHeight;

          let getJson = new Promise(function(data_OK) {
            const xmlhttp = new XMLHttpRequest();              
                  xmlhttp.open("GET", url2json);
                  xmlhttp.onload = function() {
                    if (xmlhttp.status == 200) {
                      res = xmlhttp.responseText;
                      data_OK(JSON.parse(res));
                    } else {
                      nodata('no JSON');
                    }                       
                };            
                xmlhttp.send();   
              });

          getJson.then(
            function(json_obj) {
              google.charts.load('current', {
                callback: function () {
                $(window).resize(drawChart);
                drawChart(json_obj);
              },
              packages: ["calendar"]
              });
              },
            // function(nodata) {console.log('no JSON')} 
          );
      
        // <!--get data from local json-->
        // function readTextFile(file, callback) {
        //     var rawFile = new XMLHttpRequest();
        //         rawFile.overrideMimeType("application/javascript");
        //         rawFile.open("GET", file, true);
        //         rawFile.onreadystatechange = function() {
        //         if (rawFile.readyState === 4 && rawFile.status == "200") {
        //             callback(rawFile.responseText);
        //         }
        //     }
        //     rawFile.send(null);
        // }

        // readTextFile("./json4datatable.json", function(text) {
        //     json_data = JSON.parse(text);
        //     });

        function drawChart(json_obj) {

          var dataTable = new google.visualization.DataTable();
          dataTable.addColumn({ type: 'date', id: 'Date' });
          dataTable.addColumn({ type: 'number', id: 'Capture' });
          dataTable.addColumn({ type: 'string', role: 'tooltip', p: { 'html': true } })
          
          // populate chart datatable
          for (let x in json_obj) {
            dataTable.addRows([
            [new Date(Date.parse(json_obj[x].date)), 1, createCustomHTMLContent(json_obj[x].img, json_obj[x].date, json_obj[x].name, json_obj[x].verse)]
            ]);
            }

          var chart = new google.visualization.Calendar(document.getElementById('calendar_basic'));

          var options = {

            legend: 'none',
            title: '',
            focusTarget: 'category',            
            height: height/1.5,  
            width: width,          

            colorAxis: {
              colors:['#A3A2A1','#A3A2A1'],
              values: [1,0]
              
            },

            tooltip: {
              isHtml: true,
              trigger: 'selection'
            },

            noDataPattern: {
              backgroundColor: '#161B26',
              color:  '#161B26'
            },

            calendar: {
              backgroundColor:'black',          
              cellSize: width/56,     // make chart responsive      
              daysOfWeek: 'smtwtfs',
              underYearSpace: 12,
              dayOfWeekRightSpace: 12,
              underMonthSpace: 10,            

              monthOutlineColor: {
                stroke: '#080e1a',
                strokeOpacity: 1,
                strokeWidth: 1
              },
              
              unusedMonthOutlineColor: {
                stroke: '#080e1a',
                strokeOpacity: 1,
                strokeWidth: 2
              },

              focusedCellColor: {
                stroke: '#CE2932',
                strokeOpacity: 1,
                strokeWidth: 0
              },

              cellColor: {
                stroke: '#080e1a',      // Color the border of the squares.
                strokeOpacity: 1, // Make the borders half transparent.
                strokeWidth: 9     // ...and two pixels thick.
              },

              dayOfWeekLabel: {
                fontName: 'Courier New',
                fontSize: 16,
                color: '#D1CDCA',
                bold: false,
                italic: false,
              },

              monthLabel: {
                fontName: 'Courier New',
                fontSize: 17,
                color: '#D1CDCA',
                bold: false,
                italic: false
              },

              yearLabel: {
                fontName: 'Courier New',
                fontSize: 20,
                color: '#D1CDCA',
                bold: false,
                italic: false
              }          
            }
          };

        // hide chart heatmap legend in the upright  corner
        google.visualization.events.addListener(chart, 'ready', function () {
          $($('#calendar_basic text')[0]).hide();
          $($('#calendar_basic text')[1]).hide();
          $($('#calendar_basic text')[2]).hide();
          $('#calendar_basic linearGradient').hide();
          $('#calendar_basic')
            .find('[fill-opacity="1"]').hide();
        });

          chart.draw(dataTable, options);
        }
      }

function createCustomHTMLContent(imgURL, event_time, event, verse) {
  return '<div id="img-container">' +      
    '<img id="img-box" src="' + imgURL + '">' + 
    '</div>' +
    '<div id="verse" class="w3-display-topleft">' +
    verse +
    '</div>' +        
    '<div id="name-date" class="w3-display-bottomleft">' +                 
    event + '<br/>' + 
    event_time +        
    '</div>'+
    '</div>';              
}


function switchOn_b1() {  
  document.getElementById("calendar_basic").className = "calendar_basic_0";
  document.getElementById("blocks").style.display = "flex"; 
  document.getElementById("blocks").style.visibility = "visible";    
}  

function switchOn_b2() {
  document.getElementById("blocks").style.display = "none";   
  document.getElementById("calendar_basic").className = "calendar_basic_1";       
} 

window.addEventListener("resize", xnsmn_chart);
xnsmn_chart();

// $(window).resize(function(){
//     xnsmn_chart();  
// });
