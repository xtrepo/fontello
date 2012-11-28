'use strict';


/*global window, _, $, ko, N*/


// starts download of the result font
function injectDownloadUrl(id, url) {
  $('iframe#' + id).remove();
  $('<iframe></iframe>').attr({id: id, src: url}).css('display', 'none')
    .appendTo(window.document.body);
}


// prepare config for the font builder
function getConfig(self) {
  var config = {
    name:   $.trim(self.fontname()),
    glyphs: []
  };

  _.each(self.selectedGlyphs(), function (glyph) {
    config.glyphs.push({
      uid:        glyph.uid,

      orig_css:   glyph.originalName,
      orig_code:  glyph.originalCode,

      css:        glyph.name(),
      code:       glyph.code(),

      src:        glyph.font.fontname
    });
  });

  N.logger.debug('Built result font config', config);

  return config;
}


// Request font build and download on success
//
module.exports = function (data, event) {
  if (!this.selectedCount()) {
    return false;
  }

  N.server.font.generate(getConfig(this), function (err, msg) {
    var font_id;

    if (err) {
      N.emit('notification', 'error', N.runtime.t('errors.fatal', {
        error: (err.message || String(err))
      }));
      return;
    }

    font_id = msg.data.id;

    N.emit('notification', 'information', {
      layout:   'bottom',
      closeOnSelfClick: false,
      timeout:  20000 // 20 secs
    }, N.runtime.t('info.download_banner'));

    N.emit('build.started');

    function poll_status() {
      N.server.font.status({id: font_id}, function (err, msg) {
        if (err) {
          N.emit('notification', 'error', N.runtime.t('errors.fatal', {
            error: (err.message || String(err))
          }));
          N.emit('build.finished');
          return;
        }

        if ('error' === msg.data.status) {
          N.emit('notification', 'error', N.runtime.t('errors.fatal', {
            error: (msg.data.error || "Unexpected error.")
          }));
          N.emit('build.finished');
          return;
        }

        if ('finished' === msg.data.status) {
          // TODO: normal notification about success
          N.logger.info("Font successfully generated. " +
                        "Your download link: " + msg.data.url);
          injectDownloadUrl(font_id, msg.data.url);
          N.emit('build.finished');
          return;
        }

        if ('enqueued' === msg.data.status) {
          // TODO: notification about queue
          N.logger.info("Your request is in progress and will be available soon.");
          setTimeout(poll_status, 500);
          return;
        }

        // Unexpected behavior
        N.logger.error("Unexpected behavior");
      });
    }

    // start polling
    poll_status();
  });
};
