import csv
import io
import requests

destination = "./src/translation/tr.json"
translations = "en_US SKIP SKIP ar ast az bg bn_BN ca cs_CZ da_DK de_DE el eo es fa fil fi fr_FR fr_CH gl he hr_HR hsb hu_HU in_ID it ja ko kz lt_LT mn nb_NO ne nl pl_PL pt_BR pt_PT ro ru sk sl_SI sr_RS sv_SE tr uk uz vi_VN zh_CN zh_HK zh_TW"

r = requests.get("https://docs.google.com/spreadsheets/d/18z00Rbt6QvLIkayEV9P89vW9oU0QbTVsjRk9nz1CeFY/export?format=tsv&id=18z00Rbt6QvLIkayEV9P89vW9oU0QbTVsjRk9nz1CeFY&gid=0")

r.encoding = 'utf-8'  # useful if encoding is not sent (or not sent properly) by the server
csvio = io.StringIO(r.text, newline="")

csv_reader = csv.reader(csvio, delimiter='\t')

# skip first 4 lines
next(csv_reader)
next(csv_reader)
next(csv_reader)
next(csv_reader)

data = list( csv_reader )

filtered_data = []
for row in data:
  col0 = row[0]
  if col0.startswith("web."): # use keys with web. only
    filtered_data.append( [col0[4:], row] )     # remove the web. prefix
  if col0.startswith("navigate."): # keys with navigate.
    filtered_data.append( [col0[9:], row] )     # remove the navigate. prefix
  
outstring = "{"
index = 0
trArray = translations.split(" ")
for tr in trArray:
  index += 1
  if tr == "SKIP":
    continue
  
  if index > 1:
    outstring += ",\n"
  
  outstring += "\"" + tr + "\":{\n"
  
  findex = 0
  for key in filtered_data:
    findex += 1
    if findex > 1:
      outstring += ",\n"

    outstring += "\"" + key[0] + "\":\"" + key[1][index] + "\""
  
  
  outstring += "\n}"


outstring += "}"

#print(outstring)
f = open(destination, "w")
f.write(outstring)
f.close()