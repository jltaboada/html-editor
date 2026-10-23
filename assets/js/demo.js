/* Texto de relleno (Lorem ipsum) */
(function (global) {
  'use strict';

  const App = global.HTMLEditor = global.HTMLEditor || {};

  App.LIPSUM = [
    'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Integer posuere erat a ante venenatis dapibus posuere velit aliquet. Cras mattis consectetur purus sit amet fermentum. Donec ullamcorper nulla non metus auctor fringilla.',
    'Maecenas faucibus mollis interdum. Vestibulum id ligula porta felis euismod semper. Aenean lacinia bibendum nulla sed consectetur. Nullam quis risus eget urna mollis ornare vel eu leo.',
    'Curabitur blandit tempus porttitor. Etiam porta sem malesuada magna mollis euismod. Donec sed odio dui. Vivamus sagittis lacus vel augue laoreet rutrum faucibus dolor auctor.',
    'Fusce dapibus, tellus ac cursus commodo, tortor mauris condimentum nibh, ut fermentum massa justo sit amet risus. Nulla vitae elit libero, a pharetra augue. Sed posuere consectetur est at lobortis.',
    'Morbi leo risus, porta ac consectetur ac, vestibulum at eros. Praesent commodo cursus magna, vel scelerisque nisl consectetur et. Aenean eu leo quam. Pellentesque ornare sem lacinia quam venenatis vestibulum.',
  ];

  App.getLipsumHtml = function () {
    return '\n' + App.LIPSUM.map((paragraph) => '<p>' + paragraph + '</p>').join('\n') + '\n';
  };
})(window);
