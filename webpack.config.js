const path = require('path');
const CopyPlugin = require('copy-webpack-plugin');

module.exports = {
  entry: {
    popup:      './src/popup.jsx',
    background:'./src/background.js'
  },
  output: {
    filename: '[name].js',
    path:     path.resolve(__dirname, 'dist')
  },
  resolve: {
    extensions: ['.js', '.jsx']
  },
  module: {
    rules: [
      {
        test:    /\.[jt]sx?$/,
        exclude: /node_modules/,
        use:     'babel-loader'
      },
      {
        test: /\.css$/,
        use: ['style-loader','css-loader','postcss-loader']
      }
    ]
  },
  plugins: [
    new CopyPlugin({
      patterns: [
        { from: 'public/manifest.json', to: 'manifest.json' },
        { from: 'public/popup.html',    to: 'popup.html'    },
        { from: 'public/icons',         to: 'icons'         }
      ]
    })
  ]
};

