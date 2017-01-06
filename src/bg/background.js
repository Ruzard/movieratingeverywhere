// if you checked "fancy-settings" in extensionizr.com, uncomment this lines

// var settings = new Store("settings", {
//     "sample_setting": "This is how you use Store.js to remember values"
// });


(function () {
    // var object = {
//     urlPattern:"forumcinemas.ee",
//     source:'.small_txt[style*="clear: left;"]',
//     options:{destination:'a.result_h4', nextline:true, prespace:true, cut_if_found: ["IMAX 3D", "3D"],
//     imdbUrl: "http://dfsgfdgsdfg.df" 
// }
// };
    var forumcinemas = {
        urlPattern: "forumcinemas.ee",
        source: '.small_txt[style*="clear: left;"]',
    };
    var kinokosmos = {
        urlPattern: "kinokosmos.ee",
        source: 'p.originaltitle',
        options: {cut_if_found: ["IMAX 3D", "3D"], nextline:true}
    };
    var apollo = {
        urlPattern: "apollokino.ee",
        source: 'h2.list-item-desc-title small',
        options: {cut_if_found: ["\\(\\d{4}\\)"], prespace:true}
    };
//forumcinemas.ee .small_txt[style*="clear: left;"]$destination::a.result_h4,rating_nextline,cut_if_found::IMAX 3D&&Something Else,
    var rules = [forumcinemas, kinokosmos, apollo];

    chrome.extension.onMessage.addListener(
        function (request, sender) {
            if (request.from == "content" && request.action == "get_movie_rating") {
                findMovieRating(request, sender);
            } else if (request.action == "get_matching_rules") {
                findMatchingRule(request, sender);
            }
            // chrome.pageAction.show(sender.tab.id);
        });

    function findMatchingRule(request, sender) {
        var url = request.documentUrl;

        var matchedRule = null;
        $.each(rules, function (index, rule) {
            if ((new RegExp(rule.urlPattern)).test(url)) {
                matchedRule = rule;
            }
        });

        if (matchedRule) {
            chrome.tabs.sendMessage(sender.tab.id, {from: "bg", subject: "matching_rule", rule: matchedRule});
        } else {
            chrome.tabs.sendMessage(sender.tab.id, {
                from: "bg",
                subject: "matching_rule",
                error: true,
                message: "No rule for " + url
            });
        }
    }

    function findMovieRating(request, sender) {
        var movieName = request.movieName;

        var preparedMovieName = prepareMovieNameForStorage(movieName);

        var requestObject = {};
        requestObject[preparedMovieName] = {};

        chrome.storage.local.get(requestObject, function (response) {
            var savedObject = response[preparedMovieName];

            if(!savedObject.rating || (Date.now() - savedObject.timestamp > 345600000)){ //4 days in milisec - outdated or no data saved
                console.log("No saved data for " + movieName);
                getRatingFromInternet();
                return;
            }

            console.log("received rating from local storage: " + movieName + " - " + savedObject.rating);
            chrome.tabs.sendMessage(sender.tab.id, {
                from: "bg",
                subject: "movie_rating",
                rule: request.rule,
                rating: savedObject.rating,
                imdbUrl: savedObject.imdbUrl,
                requestElementIndex: request.requestElementIndex
            })

        });

        function getRatingFromInternet() {
            var searchUrl = "http://www.imdb.com/find?q=" + encodeURIComponent(movieName);
            $.get(searchUrl)
                .done(function (data) {
                    data = data.replace("<!DOCTYPE html>", "").replace(/<img\b[^>]*>/ig, '').trim();
                    //var href = $('ul.tabs').find('a').slice(0,1).attr('href');
                    var elem = $(data).find("td.result_text").find("a");
                    if (elem.length > 0) {
                        // console.log("data loaded: http://www.imdb.com" + elem.attr("href"));
                        var moviePageUrl = "http://www.imdb.com" + elem.attr("href");
                        findRatingOnPage(moviePageUrl, request, sender);
                    } else {
                        var errorText = "no movie found for name " + movieName;
                        console.log(errorText);

                        chrome.tabs.sendMessage(sender.tab.id, {
                            from: "bg",
                            subject: "movie_rating",
                            error: true,
                            message: errorText
                        });
                    }
                });
        }
    }

    function findRatingOnPage(url, request, sender) {
        $.get(url)
            .done(function (data) {
                data = data.replace("<!DOCTYPE html>", "").replace(/<img\b[^>]*>/ig, '').trim();
                var elem = $(data).find('span[itemprop="ratingValue"]');
                if (elem.length > 0) {
                    var rating = elem.text().trim();

                    //update storage
                    var preparedMovieName = prepareMovieNameForStorage(request.movieName);
                    var storageObject = {};
                    storageObject[preparedMovieName] = {rating:rating, imdbUrl:url, timestamp:Date.now()};
                    chrome.storage.local.set(storageObject, function(){
                        //sending the result back after caching the data
                        console.log("Movie " + request.movieName + " is saved to local storage as " + preparedMovieName);
                        chrome.tabs.sendMessage(sender.tab.id, {
                            from: "bg",
                            subject: "movie_rating",
                            rule: request.rule,
                            rating: rating,
                            imdbUrl: url,
                            requestElementIndex: request.requestElementIndex
                        });
                    });

                    console.log(url + " - rating loaded:" + rating);
                }
            });
    }

    var a = {"õ":"y","ö":"yo","ä":"ya","ü":"yu","Ё":"YO","Й":"I","Ц":"TS","У":"U","К":"K","Е":"E","Н":"N","Г":"G","Ш":"SH","Щ":"SCH","З":"Z","Х":"H","Ъ":"'","ё":"yo","й":"i","ц":"ts","у":"u","к":"k","е":"e","н":"n","г":"g","ш":"sh","щ":"sch","з":"z","х":"h","ъ":"'","Ф":"F","Ы":"I","В":"V","А":"a","П":"P","Р":"R","О":"O","Л":"L","Д":"D","Ж":"ZH","Э":"E","ф":"f","ы":"i","в":"v","а":"a","п":"p","р":"r","о":"o","л":"l","д":"d","ж":"zh","э":"e","Я":"Ya","Ч":"CH","С":"S","М":"M","И":"I","Т":"T","Ь":"","Б":"B","Ю":"YU","я":"ya","ч":"ch","с":"s","м":"m","и":"i","т":"t","ь":"'","б":"b","ю":"yu"};
    function prepareMovieNameForStorage(word){
        return word.replace(/\s/g, '').split('').map(function (char) {
            return a[char] || char;
        }).join("");
    }

})();