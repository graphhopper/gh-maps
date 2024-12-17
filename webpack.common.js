const path = require('path')
const fs = require('fs')
const webpack = require('webpack')

const HTMLWebpackPlugin = require('html-webpack-plugin')
const CopyPlugin = require('copy-webpack-plugin')

const localConfig = path.resolve(__dirname, 'config-local.js')
const defaultConfig = path.resolve(__dirname, 'config.js')
let config
if (fs.existsSync(localConfig)) {
    config = localConfig
} else if (fs.existsSync(defaultConfig)) {
    config = defaultConfig
} else {
    throw `The config file is missing: ${defaultConfig}`
}

// get git info from command line
const gitSHA = require('child_process').execSync('git rev-parse HEAD').toString().trim()

let package = require('./package.json')

module.exports = {
    entry: path.resolve(__dirname, 'src', 'index.tsx'),
    output: {
        path: path.resolve(__dirname, 'dist'),
        filename: 'bundle.[contenthash].js',
    },
    resolve: {
        alias: {
            '@': path.resolve(__dirname, 'src'),
        },
        extensions: ['.ts', '.tsx', '.js', '.json', '.css', '.svg'],
    },
    module: {
        rules: [
            { test: /\.tsx?$/, loader: 'ts-loader' },
            {
                enforce: 'pre',
                test: /\.js$/,
                loader: 'source-map-loader',
            },
            // We use css modules for our own code, which uses .module.css as naming convention.
            {
                test: /\.module\.css$/,
                exclude: path.resolve(__dirname, 'node_modules'),
                use: [
                    { loader: 'style-loader' },
                    {
                        loader: 'css-loader',
                        options: {
                            modules: {
                                localIdentName: '[path][name]__[local]',
                            },
                        },
                    },
                ],
            },
            // All other css files are simply processed without modules.
            // We use these for some 3rd party dependencies like ol and codemirror.
            {
                test: /\.css$/,
                exclude: /\.module\.css$/,
                use: [{ loader: 'style-loader' }, { loader: 'css-loader' }],
            },
            // this loader inlines svg images as react components
            {
                test: /\.svg$/,
                exclude: path.resolve(__dirname, 'src/pathDetails/img'),
                use: ['@svgr/webpack'],
            },
            // HeightGraph.css loads svg files using url(), so we need to add them as asset modules
            {
                test: /\.svg$/,
                include: path.resolve(__dirname, 'src/pathDetails/img'),
                type: 'asset',
            },
            {
                test: /\.png$/i,
                type: 'asset',
            },
            {
                test: /\.ttf$/i,
                type: 'asset',
            },
        ],
    },
    plugins: [
        new HTMLWebpackPlugin({ template: path.resolve(__dirname, 'src/index.html') }),
        // config.js is kept outside the bundle and simply copied to the dist folder
        new CopyPlugin({
            patterns: [
                {
                    from: config,
                    to: 'config.js',
                },
            ],
        }),
        new CopyPlugin({
            patterns: [
                {
                    from: './src/manifest.json',
                    to: 'manifest.json',
                    // see https://stackoverflow.com/a/54700817/194609
                    transform(content, path) {
                        let manifest = JSON.parse(content.toString())
                        manifest.version = package.version
                        return JSON.stringify(manifest, null, 2)
                    },
                },
            ],
        }),
        new webpack.DefinePlugin({
            GIT_SHA: JSON.stringify(gitSHA),
        }),
    ],

    externals: {
        config: 'config',
    },

    // When importing a module whose path matches one of the following, just
    // assume a corresponding global variable exists and use that instead.
    // This is important because it allows us to avoid bundling all of our
    // dependencies, which allows browsers to cache those libraries between builds.

    // maybe use this later, but with HTMLWebpackPlugin it is easier without
    /*  externals: {
          "react": "React",
          "react-dom": "ReactDOM"
      }
      */
}
