const { mergeWithRules, CustomizeRule } = require('webpack-merge')
const path = require('path')

const common = require('./webpack.common.js')

const FaviconsWebpackPlugin = require('favicons-webpack-plugin')
common.plugins.push(
    new FaviconsWebpackPlugin({
        logo: './src/logo.svg',
        favicons: {
            icons: { appleStartup: false, yandex: false, coast: false },
        },
    })
)

const develop = {
    mode: 'development',
    devtool: 'source-map',
    devServer: {
        static: path.resolve(__dirname, 'dist'),
        https: false,
        port: 3000,
        host: '0.0.0.0',
    },
}

const mergePattern = {
    module: {
        rules: {
            test: CustomizeRule.Match,
            exclude: CustomizeRule.Match,
            use: {
                loader: CustomizeRule.Match,
                options: CustomizeRule.Replace,
            },
        },
    },
}

module.exports = mergeWithRules(mergePattern)(common, develop)
