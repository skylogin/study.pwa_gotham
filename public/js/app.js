$(document).ready(function() {
  // Fetch and render upcoming events in the hotel
  $.getJSON("/events.json", renderEvents);

  // 메시지를 통해 logout을 누르면 전체 페이지에서 모두 수행
  if("serviceWorker" in navigator){
    // sw로 부터 navigate 메시지를 받으면 로그아웃할 액션 처리
    navigator.serviceWorker.addEventListener("message", function(event){
      var data = event.data;
      if(data.action === "navigate"){
        console.log("client ::: location");
        window.location.href = data.url;
      } else if(data.action === "update-reservation"){
        updateReservationDisplay(data.reservation);
      }
    });

    // logout 버튼에 대한 이벤트처리 - sw로 logout 메시지를 보낸다.
    $("#logout-button").click(function(event){
      if(navigator.serviceWorker.controller){
        event.preventDefault();
        console.log("client->server ::: logout");
        navigator.serviceWorker.controller.postMessage({
          action: "logout"
        });
      }

    });
  }
});

// 서비스워크에 대한 지원브라우저만 등록한다. 
if("serviceWorker" in navigator){
  navigator.serviceWorker.register("/serviceworker.js")
    .then(function(registration){
      console.log("Service Worker registered with scope:", registration.scope);
    }).catch(function(err){
      console.log("Service Worker registration failed:", err);
    });
}

if("serviceWorker" in navigator){
  navigator.serviceWorker.addEventListener("message", function(event){
    if(event.data === "events-returned-from-cache"){
      // alert("You are currently offline. The content of this page may be out of date");
    }
  });
}



/* ************************************************************ */
/* The code below this point is used to render to the DOM. It   */
/* completely ignores common sense principles as a trade off    */
/* for readability.                                             */
/* You can ignore it, or you can send angry tweets about it to  */
/* @TalAter                                                     */
/* ************************************************************ */

var renderEvents = function(data) {
  data.forEach(function(event) {
    $(
      "<div class=\"col-lg-2 col-md-4 col-sm-6 event-container\"><div class=\"event-card\">"+
      "<div class=\"event-date\">"+event.date+"</div>"+
      "<img src=\""+event.img+"\" alt=\""+event.title+"\" class=\"img-responsive\" />"+
      "<h4>"+event.title+"</h4>"+
      "<p>"+event.description+"</p>"+
      "</div></div>"
    ).insertBefore("#events-container div.calendar-link-container");
  });
};
