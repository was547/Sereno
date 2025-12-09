# Sereno - Paint & Relax

A relaxing painting app inspired by the Lake Coloring Book, designed for
tablets. Choose an image from the gallery and paint freely using a
stylus pen.

You can test a live version at: **https://vayawoz.es/draw/**

------------------------------------------------------------------------

## Features

-   **Image Gallery**: A collection of illustrations to color\
-   **Painting Tools**: Brush, paint bucket, and eraser\
-   **Customization**: Adjustable brush size, opacity, and color
    palette\
-   **Saving**: Projects are stored locally on the device (IndexedDB)\
-   **History**: Undo/redo actions (Ctrl+Z / Ctrl+Shift+Z)\
-   **Touch & Stylus**: Supports touch, Apple Pencil, and other
    pressure-sensitive styluses

------------------------------------------------------------------------

## How to Use

### Option 1: Local Server

``` bash
# Python 3
python -m http.server 8000

# Node.js
npx serve
```

Then open `http://localhost:8000` in your browser.

### Option 2: Open Directly

Open the `index.html` file in your browser.\
*Note: Some features may not work due to CORS restrictions.*

------------------------------------------------------------------------

## Controls

### Tools

-   **Brush**: Freehand painting\
-   **Bucket**: Fill areas\
-   **Eraser**: Remove paint

### Keyboard Shortcuts

-   `Ctrl/Cmd + Z`: Undo\
-   `Ctrl/Cmd + Shift + Z`: Redo\
-   `Ctrl/Cmd + S`: Save project

------------------------------------------------------------------------

## Compatibility

-   Safari (iPad)\
-   Chrome (Android tablets)\
-   Modern desktop browsers\
-   Apple Pencil and other stylus support

------------------------------------------------------------------------

## Adding New Images

1.  Add an SVG file to the `images/` directory\
2.  Edit `app.js` and add a new entry to the `imageLibrary` array:

``` javascript
{
    id: 'my-image',
    name: 'Image Name',
    src: 'images/my-image.svg',
    category: 'category'
}
```

------------------------------------------------------------------------

## Modifying the Color Palette

Edit the `colorPalette` array in `app.js`.

------------------------------------------------------------------------

## License

Free for personal and educational use.
