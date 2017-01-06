var foundElements;

chrome.extension.onMessage.addListener(function (response) {
    if (response.error) {
        console.log("BG_Error: " + response.message);
        return;
    }


    if (response.subject == "matching_rule") {
        requestMovieRating(response.rule);
    } else if (response.subject == "movie_rating") {
        insertReceivedRating(response);
    }
});


document.onreadystatechange = function () {
    if (document.readyState === "interactive" || document.readyState === "complete") {
        chrome.extension.sendMessage({
            from: "content",
            action: "get_matching_rules",
            documentUrl: document.URL
        });

    }
};

// function get

function insertReceivedRating(response) {
    var rule = response.rule;

    var imdbString = 'IMDB(' + response.rating + ')';
    if(rule.options && rule.options.prespace){
        imdbString = ' ' + imdbString;
    }

    var $imdbRating = $("<a>", {
        href: response.imdbUrl,
        text: imdbString
    });

    if (rule.options && rule.options.nextline == true) {
        $("<br/>").prependTo($imdbRating);
    }

    var requestSource = foundElements[response.requestElementIndex];
    if (rule.options && rule.options.destination) {
        $imdbRating.appendTo($(requestSource).parent().find(rule.options.destination));
    } else {
        $imdbRating.appendTo(requestSource);
    }
}

function requestMovieRating(matchingRule) {
    foundElements = $(matchingRule.source);
    foundElements.each(function (index) {
        var englishMovieName = this.innerText;
        if (matchingRule.options && matchingRule.options.cut_if_found) {
            $.each(matchingRule.options.cut_if_found, function (index, cut) {
                englishMovieName = englishMovieName.replace(new RegExp(cut), '').trim();
            });
        }
        englishMovieName = englishMovieName.trim();

        chrome.extension.sendMessage({
            from: "content",
            action: "get_movie_rating",
            movieName: englishMovieName,
            rule: matchingRule,
            requestElementIndex: index
        });
    });
}


