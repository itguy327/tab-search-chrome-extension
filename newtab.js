/*global chrome:true*/

const results = document.getElementById('results');
const storageResults = document.getElementById('storageResults');
const searchBox = document.getElementById('searchText');
const form = document.getElementById('searchForm');
const clearStorageButton = document.getElementById('clearStorage');

let activeUrls = []; // { windowId: id, tabId: id, url: url }

clearStorageButton.addEventListener("click", function () {
  chrome.storage.local.clear();
});

form.addEventListener("submit", processForm);
form.addEventListener("submit", processFormForStorage);

// eslint-disable-next-line no-unused-vars
chrome.management.onEnabled.addListener(function (info) {
  updateActiveUrls();
  chrome.tabs.query({}, function (tabs) {
    for (let i = 0; i < tabs.length; i++) {
      if (tabs[i].url.substr(0, 6) === 'chrome') {
        continue;
      }

      let tab = tabs[i];
      saveActiveTabContents(tab.id);
    }
  });
});

chrome.tabs.onRemoved.addListener(function (tabId, removeInfo) {
  let windowId = removeInfo.windowId;
  removeActiveUrl(windowId, tabId);
});

function updateActiveUrls() {
  activeUrls = [];

  chrome.tabs.query({}, function (tabs) {
    for (let i = 0; i < tabs.length; i++) {
      chrome.tabs.get(tabs[i].id, function (tab) {
        activeUrls.push({
          windowId: tab.windowId,
          tabId: tab.id,
          url: tab.url
        });
      });
    }
  });
}

function removeActiveUrl(windowId, tabId) {
  let index = activeUrls.findIndex(function (element) {
    if (element.windowId === windowId && element.tabId === tabId) {
      return true;
    }
    return false;
  });

  if (index > -1) {
    activeUrls.splice(index, 1);
  }
}

function saveActiveTabContents(tabId) {
  chrome.tabs.get(tabId, function (tab) {
    if (tab.url.substr(0, 6) === 'chrome') {
      return;
    }

    chrome.tabs.executeScript(
      tab.id,
      { file: 'content_script.js' },
      function () {
        chrome.tabs.sendMessage(tab.id, {
          msg: "getContents",
          tabId: tab.id
        }, function (response) {

          if (response) {
            let tabId = response.tabId;
            chrome.tabs.get(tabId, function (tab) {
              let content = response.tabContents;
              let url = tab.url;
              let tabTitle = tab.title;
              let favIconUrl = tab.favIconUrl;

              chrome.storage.local.get(['data'], function (result) {
                let newData;
                if (result && result.data) {
                  result.data.push({
                    url: url,
                    tabTitle: tabTitle,
                    favIconUrl: favIconUrl,
                    content: content
                  });
                  newData = result.data;
                } else {
                  newData = [{
                    url: url,
                    tabTitle: tabTitle,
                    favIconUrl: favIconUrl,
                    content: content
                  }];
                }
                chrome.storage.local.set({ 'data': newData });
              });
            });
          }

        });
      }
    );
  });
}

// eslint-disable-next-line no-unused-vars
chrome.tabs.onUpdated.addListener(function (tabId, changeInfo, tab) {
  if (changeInfo.status === 'complete') {
    updateActiveUrls();

    let windowId = tab.windowId;
    if (!activeUrls.find(function (element) {
      return element.windowId === windowId && element.tabId == tabId;
    })) {
      saveActiveTabContents(tabId);
    }
  }
});

function processFormForStorage(e) {
  if (e.preventDefault) e.preventDefault();

  let searchText = searchBox.value;

  storageResults.innerHTML = "";

  chrome.storage.local.get(['data'], function (result) {
    if (!result.data) {
      return;
    }

    for (let j = 0; j < result.data.length; j++) {
      let url = result.data[j].url;

      if (!activeUrls.find(function (element) {
        return element.url === url;
      })) {
        let tabTitle = result.data[j].tabTitle;
        let favIconUrl = result.data[j].favIconUrl;
        let content = result.data[j].content;

        let pos = content.toLowerCase().search(searchText.toLowerCase());
        if (pos > -1) {
          let contextAmount = 100;
          let beforeContext = pos - contextAmount;
          let afterContext = pos + contextAmount;

          if (beforeContext < 0) {
            beforeContext = 0;
          }
          if (afterContext > content.length - 1) {
            afterContext = content.length - 1;
          }

          let faviconStr = favIconUrl ? favIconUrl : '';

          storageResults.innerHTML += "<div class='result'><div class='resultTexts'><a class='closeTab' target='_blank' href='" + url + "'><img class='favicon' src='" + faviconStr + "'><img>" + tabTitle + "</a><p class='context'>" + content.substr(beforeContext, searchText.length + contextAmount * 2) + "</p></div></div>";
        }
      }
    }
  });

  return false;
}

function processForm(e) {
  if (e.preventDefault) e.preventDefault();

  let searchText = searchBox.value;
  let tabContents = [];
  results.innerHTML = "";

  chrome.tabs.query({}, function (tabs) {
    for (let i = 0; i < tabs.length; i++) {

      if (tabs[i].url.substr(0, 6) === 'chrome') {
        continue;
      }

      chrome.tabs.executeScript(
        tabs[i].id,
        { file: 'content_script.js' },
        function () {
          chrome.tabs.sendMessage(tabs[i].id, {
            msg: "getContents",
            tabId: tabs[i].id
          }, function (response) {

            let tabId = response.tabId;
            chrome.tabs.get(tabId, function (tab) {
              let content = response.tabContents;
              let windowId = tab.windowId;

              let tabIndex = tab.index;
              let tabTitle = tab.title;
              let favIconUrl = tab.favIconUrl;

              let pos = content.toLowerCase().search(searchText.toLowerCase());
              if (pos > -1) {
                let contextAmount = 100;
                let beforeContext = pos - contextAmount;
                let afterContext = pos + contextAmount;

                if (beforeContext < 0) {
                  beforeContext = 0;
                }
                if (afterContext > content.length - 1) {
                  afterContext = content.length - 1;
                }

                let faviconStr = favIconUrl ? favIconUrl : '';

                results.innerHTML += "<div class='result'><div class='resultTexts'><p class='tabname' id='tab-" + windowId + "-" + tabIndex + "'><img class='favicon' src='" + faviconStr + "'><img>" + tabTitle + "</p><p class='context'>" + response.tabContents.substr(beforeContext, searchText.length + contextAmount * 2) + "</p></div></div>";

                tabContents.push({ windowId: windowId, tabIndex: tabIndex });

                for (let j = 0; j < tabContents.length; j++) {
                  let windowId = tabContents[j].windowId;
                  let tabIndex = tabContents[j].tabIndex;
                  let tabButton = document.getElementById('tab-' + windowId + '-' + tabIndex);

                  if (tabButton) {
                    tabButton.addEventListener('click', function (el) {
                      let regex = /tab-(\d+)-(\d+)/;
                      let matches = Array.from(el.target.id.matchAll(regex));
                      let windowId = parseInt(matches[0][1], 10);
                      let tabIndex = parseInt(matches[0][2], 10);

                      chrome.windows.update(windowId, { focused: true });
                      chrome.tabs.highlight({
                        windowId: windowId,
                        tabs: [tabIndex]
                      })
                    });
                  }
                }
              }
            });
          });
        });
    }
  });

  return false;
}
