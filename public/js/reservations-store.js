var DB_VERSION = 2;
var DB_NAME = "gih-reservations";

// db를 여는 helper 함수
var openDatabase = function(){
    // 프로미스 방식
    return new Promise(function(resolve, reject){
        if(!self.indexedDB){
            reject("IndexedDB not supported");
        }
        var request = self.indexedDB.open(DB_NAME, DB_VERSION);
        request.onerror = function(event){
            reject("Database error: ", event.target.error);
        };
        request.onupgradeneeded = function(event){
            var db = event.target.result;
            
            //offline 처리를 위해 status 필드를 추가
            var upgradeTransaction = event.target.transaction;
            var reservationsStore;

            if(!db.objectStoreNames.contains("reservations")){
                db.createObjectStore("reservations", {
                    keyPath: "id"
                });
            } else{
                reservationsStore = upgradeTransaction.objectStore("reservations");
            }

            // 기존 사용자들은 reservationsStore를 index없이 가지고 있기에 버전관리를 위해 이렇게 처리
            if(!reservationsStore.indexNames.contains("idx_status")){
                reservationsStore.createIndex("idx_status", "status", {
                    unique: false
                });
            }
        }; 
        request.onsuccess = function(event){
            resolve(event.target.result);
        };
    });

    // 전통적인 js 방식
    // IndexedDB 지원여부 확인
    // if(!window.indexedDB){
    //     return false;
    // }
    // var request = window.indexedDB.open("gih-reservations", 1);
    // request.onerror = function(event){
    //     console.log("Database error: ", event.target.error);
    // };
    // request.onupgradeneeded = function(event){
    //     var db = event.target.result;
    //     if(!db.objectStoreNames.contains("reservations")){
    //         db.createObjectStore("reservations", {
    //             keyPath: "id"
    //         });
    //     }
    // };
    // return request;
};

// 오브젝트 스토어를 여는 helper 함수
var openObjectStore = function(db, storeName, transactionMode){
    // 프로미스 방식
    return db.transaction(storeName, transactionMode)
            .objectStore(storeName);
};
// 전통적 JS 방식
// var openObjectStore = function(storeName, successCallback, transactionMode){
    // var db = openDatabase();
    // if(!db){
    //     return false;
    // }
    // db.onsuccess = function(event){
    //     var db = event.target.result;
    //     var objectStore = db.transaction(storeName, transactionMode)
    //                         .objectStore(storeName);
    //     successCallback(objectStore);
    // };
    // return true;
// };

// insert helper
var addToObjectStore = function(storeName, object){
    // 프로미스 방식
    return new Promise(function(resolve, reject){
        openDatabase().then(function(db){
            openObjectStore(db, storeName, "readwrite")
                .add(object).onsuccess = resolve;
        }).catch(function(error){
            reject(error);
        });
    });

    // 전통적 JS방식
    // openObjectStore(storeName, function(store){
    //     store.add(object);
    // }, "readwrite");
};

// update helper
var updateInObjectStore = function(storeName, id, object){
    // 프로미스
    return new Promise(function(resolve, reject){
        openDatabase().then(function(db){
            openObjectStore(db, storeName, "readwrite")
                .openCursor().onsuccess = function(event){
                    var cursor = event.target.result;
                    if(!cursor){
                        reject("Reservation not found in object store");
                    }
                    if(cursor.value.id === id){
                        cursor.update(object).onsuccess = resolve;
                        return;
                    }
                    cursor.continue();
                };
        }).catch(function(error){
            reject(error);
        });
    });
    
    // 전통적 JS 방식
    // openObjectStore(storeName, function(objectStore){
    //     objectStore.openCursor().onsuccess = function(event){
    //         var cursor = event.target.result;
    //         if(!cursor){
    //             return;
    //         }
    //         if(cursor.value.id === id){
    //             cursor.update(object);
    //             return;
    //         }
    //         cursor.continue();
    //     };
    // }, "readwrite");
};

// 예약정보를 db를 통해 가져오는 함수, 실패할 경우 네트워크를 통해 json을 읽어온다.
var getReservations = function(indexName, indexValue){
// var getReservations = function(){
    // 프로미스
    return new Promise(function(resolve){
        openDatabase().then(function(db){
            var objectStore = openObjectStore(db, "reservations");
            var reservations = [];

            // offline 추가를 위해 index가 추가되어 로직을 변경 (기존 사용자들은 index가 없기에 이런식으로 분기처리)
            var cursor;
            if(indexName && indexValue){
                cursor = objectStore.index(indexName).openCursor(indexValue);
            } else{
                cursor = objectStore.openCursor();
            }

            // 기존로직
            cursor.onsuccess = function(event){
                var cursor = event.target.result;
                if(cursor){
                    reservations.push(cursor.value);
                    cursor.continue();
                } else{
                    if(reservations.length > 0){
                        resolve(reservations);
                    } else{
                        getReservationsFromServer().then(function(reservations){
                            openDatabase().then(function(db){
                                var objectStore = openObjectStore(db, "reservations", "readwrite");
                                for(var i=0; i<reservations.length; i++){
                                    objectStore.add(reservations[i]);
                                }
                                resolve(reservations);
                            });
                        });
                    }
                }
            };
        }).catch(function(){
            getReservationsFromServer().then(function(reservations){
                resolve(reservations);
            });
        });
    });
};



// 전통적 JS방식
// var getReservations = function(successCallback){    
//     var reservations = [];
//     var db = openObjectStore("reservations", function(objectStore){
//         objectStore.openCursor().onsuccess = function(event){
//             var cursor = event.target.result;
//             if(cursor){
//                 reservations.push(cursor.value);
//                 cursor.continue();
//             } else{
//                 if(reservations.length > 0){
//                     successCallback(reservations);
//                 } else{
//                     $.getJSON("/reservations.json", function(reservations){
//                         openObjectStore("reservations", function(reservationsStore){
//                             for(var i=0; i<reservations.length; i++){
//                                 reservationsStore.add(reservations[i]);
//                             }
//                             successCallback(reservations);
//                         }, "readwrite");
//                     });
//                 }
//             }
//         };
//     });
//     if(!db){
//         $.getJSON("/reservations.json", successCallback);
//     }
// };

var getReservationsFromServer = function(){
    return new Promise(function(resolve){
        if(self.$){
            $.getJSON("/reservations.json", resolve);
        } else if(self.fetch){
            fetch("/reservations.json").then(function(response){
                return response.json();
            }).then(function(reservations){
                resolve(reservations);
            });
        }
    });
};
