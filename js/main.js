const get_Json = fetch("https://sedeyre.github.io/json4datatable.json")
  .then(function(response) {
      return response.json();
  });

// const make_book = function() {
//   get_Json.then(function(res) {
//       makeBook(res);      
//   });
//   };

const make_charts = function() {
  get_Json.then(function(res) {
    google.charts.load('current', {
      callback: function () {
      // $(window).resize(drawChart);
      drawChart(res);
      makeBook(res);                
    },
    packages: ["calendar"]
    });      
  });
  };

make_charts();
// make_book();

// function deploy_json() {

    // const url2json = "https://sedeyre.github.io/json4datatable.json";
    // // const url2json = "http://127.0.0.1:5500/sorted_dates.json";
    
    // var width = document.documentElement.clientWidth; // making chart responsive  
    // var height = document.documentElement.clientHeight;

    // let getJson = new Promise(function(data_OK) {
    //   const xmlhttp = new XMLHttpRequest();              
    //         xmlhttp.open("GET", url2json);
    //         xmlhttp.onload = function() {
    //           if (xmlhttp.status == 200) {
    //             res = xmlhttp.responseText;
    //             data_OK(JSON.parse(res));
    //           } else {
    //             nodata('no JSON');
    //           }                       
    //       };            
    //       xmlhttp.send();   
    //     });

    // getJson.then(
    //   function(json_obj) {
    //     google.charts.load('current', {
    //       callback: function () {
    //       $(window).resize(drawChart, makeBook);
    //       drawChart(json_obj);
    //       makeBook(json_obj);          
    //     },
    //     packages: ["calendar"]
    //     });
    //     },      
    // );
    
      
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

  var width = document.documentElement.clientWidth; // making chart responsive  
  var height = width*1.5;

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

  let cellSize_ = width/56; // making chart responsive

  var options = {

    legend: 'none',
    title: '',
    focusTarget: 'category',            
    height: height,  
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
      cellSize: cellSize_,     // making chart responsive      
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
        strokeWidth: cellSize_/3.5     // making chart responsive
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


function createCustomHTMLContent(imgURL, event_time, event, verse) {
  
  return '<div class="container">' + 
    '<div class="image">' + '<img src="' + imgURL + '">' +
    '</div>' +    
      '<div class="text">'+'<p>'+verse+'</p>'+'<p id="event_">'+event+'<br/>'+event_time+'</p>'+
      '</div>' +        
      // '<div id="name-date">' + event + '<br/>' + event_time +        
      // '</div>'+
  '</div>';              
}

// function makeBook(json_obj) {

//   var count = -1;
//   var entries_count = json_obj.length;

//   $("#book").turn({pages: 400,                                                  
//                   duration: 2000,
//                   gradients: true,                             
//                   autoCenter: false});

//   $('#book').bind('turning', function(event, page) {            

//       count++;

//       var range = $(this).turn('range', page);           
//       for (var page = range[0]; page<=range[1]; page++){                
//           addPage(page, json_obj, count, $(this));}
//       });
//   }

// function addPage(page, json_obj, count, book) {
  
//   let page_data = json_obj[count];  
  
//   if (!book.turn('hasPage', page)) {
      
//               if (page % 2==0){                        
//                   if (page == 6) {  // prevent repeating the previous image, no idea why it goes that way  
//                       page_data = json_obj[1];
//                   }
//                   let html = `<img src=${page_data.img} class="insights">`; 
//                   var elementImage = $("<div />").html(html);
//                   book.turn('addPage', elementImage, page);                                             
//               }
//               else {
//                   let html = `<p class="verse">${page_data.verse} + \n + ${page_data.date}</p>`;                     
//                   var element = $("<div />").html(html);
//                   book.turn('addPage', element, page);                  
//               }                           
//      }
//   }


function switchOn_b1() {  

  document.getElementById("calendar_basic").className = "calendar_basic_0";

  document.getElementById("blocks").style.display = "flex"; 
  document.getElementById("blocks").style.visibility = "visible";

  document.getElementById("book").className = "book_0";
}  

function switchOn_b2() {

  document.getElementById("blocks").style.display = "none";
  document.getElementById("menu").className = "menu_0";

  setTimeout(menu_none, 500);
  setTimeout(calendar_on, 600);

  document.getElementById("book").className = "book_0";  
}

function switchOn_b4() {

  document.getElementById("blocks").style.display = "none";
  document.getElementById("calendar_basic").style.display ="none";

  document.getElementById("menu").className = "menu_0";
  document.getElementById("logo").className = "logo_0";

  setTimeout(menu_none, 500);
  setTimeout(logo_none, 500);
  setTimeout(book_on, 1200);
  
}

function menu_none() {
  document.getElementById("menu").style.display = "none";
}
function logo_none() {
  document.getElementById("logo").style.display = "none";
}
function book_on() {
  document.getElementById("book").className = "book_1";
}
function calendar_on() {
  document.getElementById("calendar_basic").className = "calendar_basic_1";
  document.getElementById("calendar_basic").style.display ="block";
}

function makeBook(json_Obj) {      

  var count = -1;
  var entries_count = json_Obj.length;
  // define number of pages + n-starters
  var last_page = (entries_count * 2) +3;
  // define overall number of slider's range + n-closers
  $("input").attr('max', last_page +4);

  var slider = document.getElementById("slideRange");
  var output = document.getElementById("volume");
  var eventdate = document.getElementById("event_date");     
  // output.innerHTML = slider.value;
  // eventdate.innerHTML = "date";        

  $("#book").turn({
                  pages: last_page,                                                  
                  duration: 2000,
                  gradients: true,
                  turnCorners: "bl,br",
                  elevation: 100,                           
                  autoCenter: true});      

  for (let page = 4; page <= last_page; page++) {
         
      if ((page % 2) == 0) {
          count++;                   
          addPage(page, json_Obj, count, $("#book"));   
      }
      else {
          if (page == 5) {
              let count_odd = count;
              addPage(page, json_Obj, count_odd, $("#book"));
          }
          else {
              let count_odd = count;
              addPage(page, json_Obj, count_odd, $("#book"));
          }
      }
  }

  // add closers
  var last_page0 = last_page +1;
  var last_page1 = last_page +2;
  var last_page2 = last_page +3;          

  let html_page_last = ``;                                      
              var element = $("<div />").html(html_page_last).addClass("page");
  let html_hard0 = ``;                                      
              var element_hard0 = $("<div />").html(html_hard0).addClass("hard");
  let html_hard1 = ``;                                      
              var element_hard1 = $("<div />").html(html_hard1).addClass("hard");
  
  $("#book").turn("addPage", element, last_page0);
  $("#book").turn("addPage", element_hard0, last_page1);
  $("#book").turn("addPage", element_hard1, last_page2);      

  slider.oninput = function() {
      let page_ = this.value;
      // make last odd closer page accesable: 
      // if step="2" we can't see the third (even) closer page as a last odd page is NaN  
      if (page_ == last_page +4) {
          page_ = last_page +3;
          $("#book").turn("page", page_);
      }
      else {
          // output.innerHTML = this.value;
          $("#book").turn("page", page_);                
      }
  }

  // $("#book").bind("turning", function (event, page) {
  //     $("input[type=range]").val(page);
  //     // output.innerHTML = page;
  //     // eventdate.innerHTML = $(`#${page}`).text();                 
  // })

  // $("#book").bind("turned", function(event, page) {            
      // eventdate.innerHTML = $(`#${page}`).text();
      // bubbleOff();
  // })

  // const allRanges = document.querySelectorAll(".slidecontainer");
  //     allRanges.forEach(wrap => {
  //     const range = wrap.querySelector(".slider");
  //     const bubble = wrap.querySelector(".bubble");

  //     range.addEventListener("input", () => {
  //         setBubble(range, bubble);
  //     });
  //     setBubble(range, bubble);
  //     });

  // function setBubble(range, bubble) {
  //     const val = range.value;
  //     const min = range.min ? range.min : 0;
  //     const max = range.max ? range.max : 100;
  //     const newVal = Number(((val - min) * 22) / (max - min));
  //     let p = $("#book").turn("page");
  //     if (val == 1) {
  //         bubble.innerHTML = "Cover";
  //     }
  //     else {
  //         if (val == 3) {
  //         bubbleOff();
  //     }
  //         else {
  //         bubbleOn();
  //         bubble.innerHTML = $(`#${p}`).text();
  //         }
  //     }            
  //     // Sorta magic numbers based on size of the native UI thumb
  //     bubble.style.left = `calc(${newVal}% + (${8 - newVal * 0.15}px))`;
  // }

  // var bubble_V = document.getElementById("bubble_date");            
  
  // function bubbleOn() {
  //     bubble_V.style.display = "block";
  //     // bubble_V.style = "bubble";
  // }
  // function bubbleOff() {
  //     // bubble_V.style = "bubble";
  //     bubble_V.style.display = "none";
  // }
  // turn on/off slider bubble
  // slider.addEventListener('mousedown', bubbleOn);
  // slider.addEventListener('mouseup', bubbleOff);
  // slider.addEventListener('wheel', bubbleOn);  
  bookclick();
  function bookclick() {
    $("#bt_book").attr("onclick", "switchOn_b4()");
  }
}

function addPage(page, json_Obj, count, book) {
  
  let page_data = json_Obj[count];

  if (!book.turn('hasPage', page)) {

      if (page % 2==0) {
                  
              let html = `<img src=${page_data.img} class="insights">`; 
              var elementImage = $("<div />").html(html);
              book.turn('addPage', elementImage, page);                                             
          }

      else {
  
              let html = `<p class="verse">${page_data.verse}</p>
                          <p id="${page}" class="date">${page_data.date}</p>`;                     
              var elementVerse = $("<div />").html(html);
              book.turn('addPage', elementVerse, page);                       
          }                                          
     }
  }

// make responsive
window.addEventListener('resize', function (e) {
  var chart = document.getElementById("calendar_basic");
  if (chart.style.display == "block") {
    make_charts();
  }
  else {
    var book = document.getElementById("book");
    book.style.width = '';
    book.style.height = '';
    $(book).turn('size', book.clientWidth, book.clientHeight);
  }
});


