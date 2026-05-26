const path = require('path');

module.exports = {
  entry:  './src/renderer/index.js',
  devtool: 'cheap-module-source-map',   // no eval — CSP-safe source maps
  output: {
    path:     path.resolve(__dirname, 'src/renderer/dist'),
    filename: 'renderer.js',
  },
  module: {
    rules: [
      {
        test: /\.jsx?$/,
        exclude: /node_modules/,
        use: { loader: 'babel-loader', options: { presets: ['@babel/preset-env', '@babel/preset-react'] } },
      },
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader'],
      },
      {
        test: /\.(woff2?|ttf|eot)$/,
        type: 'asset/resource',
        generator: {
          filename: 'fonts/[name][ext]',
        },
      },
    ],
  },
  resolve: { extensions: ['.js', '.jsx'] },
  target: 'electron-renderer',
};