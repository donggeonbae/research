(function () {
  var form = document.getElementById("unlock-form");
  var passwordInput = document.getElementById("report-password");
  var status = document.getElementById("unlock-status");
  var payloadPath = document.body.getAttribute("data-payload");

  if (!form || !passwordInput || !payloadPath) {
    return;
  }

  function setStatus(message) {
    if (status) {
      status.textContent = message;
    }
  }

  function decodeBase64(value) {
    var binary = atob(value);
    var bytes = new Uint8Array(binary.length);

    for (var index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }

    return bytes;
  }

  function deriveKey(password, salt, iterations) {
    var encoder = new TextEncoder();

    return crypto.subtle
      .importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveKey"])
      .then(function (baseKey) {
        return crypto.subtle.deriveKey(
          {
            name: "PBKDF2",
            salt: salt,
            iterations: iterations,
            hash: "SHA-256",
          },
          baseKey,
          { name: "AES-GCM", length: 256 },
          false,
          ["decrypt"]
        );
      });
  }

  function decryptPayload(payload, password) {
    var salt = decodeBase64(payload.salt);
    var iv = decodeBase64(payload.iv);
    var ciphertext = decodeBase64(payload.ciphertext);

    return deriveKey(password, salt, payload.iterations).then(function (key) {
      return crypto.subtle.decrypt({ name: "AES-GCM", iv: iv }, key, ciphertext);
    });
  }

  function getHashTarget(documentRef, hash) {
    var id = hash.slice(1);
    var decodedId = id;

    try {
      decodedId = decodeURIComponent(id);
    } catch (error) {
      decodedId = id;
    }

    return (
      documentRef.getElementById(decodedId) ||
      documentRef.getElementById(id) ||
      documentRef.getElementsByName(decodedId)[0] ||
      documentRef.getElementsByName(id)[0]
    );
  }

  function installAnchorScrolling(iframe) {
    var documentRef = iframe.contentDocument;

    if (!documentRef) {
      return;
    }

    documentRef.addEventListener("click", function (event) {
      var target = event.target;
      var link = target && target.closest ? target.closest("a[href]") : null;
      var href = link ? link.getAttribute("href") : "";

      if (!href || href.charAt(0) !== "#") {
        return;
      }

      var anchorTarget = getHashTarget(documentRef, href);

      if (!anchorTarget) {
        return;
      }

      event.preventDefault();
      anchorTarget.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  function showReport(html) {
    var iframe = document.createElement("iframe");

    iframe.className = "report-frame";
    iframe.title = document.title;
    iframe.addEventListener("load", function () {
      installAnchorScrolling(iframe);
    });
    // Render LaTeX ($...$, $$...$$) inside the iframe using the LOCALLY vendored
    // KaTeX (no external CDN, so it works offline / on networks that block CDNs).
    // Additive only; reports without math delimiters are unaffected.
    var mathInject =
      '<link rel="stylesheet" href="../../scripts/vendor/katex/katex.min.css">' +
      '<script defer src="../../scripts/vendor/katex/katex.min.js"><\/script>' +
      '<script defer src="../../scripts/vendor/katex/contrib/auto-render.min.js"><\/script>' +
      '<script defer>document.addEventListener("DOMContentLoaded",function(){' +
      'if(window.renderMathInElement){renderMathInElement(document.body,{' +
      'delimiters:[{left:"$$",right:"$$",display:true},{left:"$",right:"$",display:false}],' +
      'throwOnError:false,ignoredTags:["script","noscript","style","textarea","pre","code"]});}});<\/script>';
    if (html.indexOf("</body>") !== -1) {
      html = html.replace("</body>", mathInject + "</body>");
    } else {
      html = html + mathInject;
    }
    iframe.srcdoc = html;
    document.body.classList.add("is-unlocked");
    document.body.appendChild(iframe);
  }

  form.addEventListener("submit", function (event) {
    event.preventDefault();

    var password = passwordInput.value;
    var button = form.querySelector("button");

    if (!password) {
      setStatus("Enter the report password.");
      return;
    }

    setStatus("Decrypting report.");
    button.disabled = true;

    fetch(payloadPath)
      .then(function (response) {
        if (!response.ok) {
          throw new Error("payload");
        }
        return response.json();
      })
      .then(function (payload) {
        return decryptPayload(payload, password);
      })
      .then(function (plaintext) {
        var decoder = new TextDecoder();

        showReport(decoder.decode(plaintext));
      })
      .catch(function () {
        button.disabled = false;
        setStatus("Unable to unlock the report. Check the password and try again.");
      });
  });
})();

