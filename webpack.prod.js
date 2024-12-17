const { merge } = require('webpack-merge')
const common = require('./webpack.common.js')

// this plugin is not necessary and very problematic for the F-droid store build so we needed to remove it from webpack.common.js
const FaviconsWebpackPlugin = require('favicons-webpack-plugin')
common.plugins.push(
    new FaviconsWebpackPlugin({
        logo: './src/logo.svg',
        favicons: {
            icons: { appleStartup: false, yandex: false, coast: false },
        },
    })
)

module.exports = merge(common, {
    mode: 'production',
})
